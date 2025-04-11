import socket
import struct
import io
import os
import hashlib
import requests
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes


# --------------------
# Utility Functions
# --------------------
def read_varint(sock_or_buf):
    num = 0
    for i in range(5):
        byte = sock_or_buf.read(1) if isinstance(sock_or_buf, io.BytesIO) else sock_or_buf.recv(1)
        if not byte:
            raise EOFError("Unexpected EOF while reading varint")
        val = byte[0]
        num |= (val & 0x7F) << (7 * i)
        if not (val & 0x80):
            break
    return num

def write_varint(value):
    output = b''
    while True:
        temp = value & 0x7F
        value >>= 7
        if value:
            output += bytes([temp | 0x80])
        else:
            output += bytes([temp])
            break
    return output

def generate_safe_token(length=16):
    while True:
        token = os.urandom(length)
        if token[0] < 0x80:
            return token

def java_hex_digest(data):
    digest = int.from_bytes(data, byteorder='big', signed=True)
    return hex(digest)[2:] if digest >= 0 else '-' + hex(-digest)[2:]

def generate_server_hash(server_id: str, shared_secret: bytes, public_key: bytes) -> str:
    sha1 = hashlib.sha1()
    sha1.update(server_id.encode('ascii'))
    sha1.update(shared_secret)
    sha1.update(public_key)
    digest = sha1.digest()
    return java_hex_digest(digest)


# --------------------
# Packet Creation
# --------------------
def create_encryption_request_packet(public_key, verify_token):
    packet_id = b'\x01'
    server_id = write_varint(0)

    pub_key_der = public_key.public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    pub_key_data = write_varint(len(pub_key_der)) + pub_key_der
    token_data = write_varint(len(verify_token)) + verify_token
    payload = packet_id + server_id + pub_key_data + token_data
    return write_varint(len(payload)) + payload

def create_set_compression_packet(threshold):
    packet_id = b'\x03'
    payload = packet_id + write_varint(threshold)
    return write_varint(len(payload)) + payload

def create_login_success_packet(uuid_str, username):
    packet_id = b'\x02'
    uuid_encoded = write_varint(len(uuid_str)) + uuid_str.encode()
    username_encoded = write_varint(len(username)) + username.encode()
    payload = packet_id + uuid_encoded + username_encoded
    return write_varint(len(payload)) + payload

def create_feature_flags_packet():
    packet_id = b'\x0A'
    features = ["minecraft:vanilla"]
    payload = write_varint(len(features))
    for feat in features:
        payload += write_varint(len(feat)) + feat.encode()
    full = packet_id + payload
    return write_varint(len(full)) + full

def create_clientbound_known_packs():
    packet_id = b'\x15'
    payload = write_varint(2)  # 2 sections (resource packs and data packs)
    for _ in range(2):
        payload += write_varint(1)
        payload += write_varint(len("example:pack")) + b"example:pack"
    full = packet_id + payload
    return write_varint(len(full)) + full

def create_registry_data_packet():
    packet_id = b'\x06'
    payload = b'\x00'  # Empty compound tag for test
    full = packet_id + payload
    return write_varint(len(full)) + full


# --------------------
# Encrypted Socket Wrapper
# --------------------
class EncryptedSocket:
    def __init__(self, sock, shared_secret):
        self.sock = sock
        cipher = Cipher(algorithms.AES(shared_secret), modes.CFB8(shared_secret))
        self.encryptor = cipher.encryptor()
        self.decryptor = cipher.decryptor()

    def send_packet(self, data):
        self.sock.sendall(self.encryptor.update(data))

    def recv_varint_packet(self):
        length = read_varint(self)
        data = self.recv(length)
        return self.decryptor.update(data)

    def recv(self, n):
        data = b''
        while len(data) < n:
            chunk = self.sock.recv(n - len(data))
            if not chunk:
                raise ConnectionError("Socket closed during recv")
            data += chunk
        return data

    def read(self, n):
        return self.recv(n)  # for read_varint compatibility


# --------------------
# Protocol Phase Handlers
# --------------------
def read_login_phase_packets(enc_sock):
    for expected_id in [0x03, 0x04]:  # Login Acknowledge, Client Info
        data = enc_sock.recv_varint_packet()
        buffer = io.BytesIO(data)
        packet_id = read_varint(buffer)
        print(f"[<] Received Login Packet ID: 0x{packet_id:02X}")
        if packet_id != expected_id:
            raise ValueError(f"Expected packet ID 0x{expected_id:02X}")

def read_serverbound_known_packs(enc_sock):
    data = enc_sock.recv_varint_packet()
    buffer = io.BytesIO(data)
    packet_id = read_varint(buffer)
    if packet_id != 0x16:
        raise ValueError("Expected Serverbound Known Packs (0x16)")
    print("[<] Received Serverbound Known Packs")


# --------------------
# Main Client Handler
# --------------------
def handle_client(conn, addr, private_key, public_key, verify_token):
    print(f"[+] Connection from {addr}")
    try:
        # Step 1: Handshake
        packet_len = read_varint(conn)
        data = conn.recv(packet_len)
        buffer = io.BytesIO(data)
        packet_id = read_varint(buffer)
        if packet_id != 0x00:
            raise ValueError("Expected Handshake")
        _ = read_varint(buffer)  # Protocol Version
        _ = buffer.read(read_varint(buffer))  # Server Address
        _ = struct.unpack(">H", buffer.read(2))[0]  # Port
        next_state = read_varint(buffer)
        if next_state != 2:
            raise ValueError("Unsupported state")

        # Step 2: Login Start
        packet_len = read_varint(conn)
        data = conn.recv(packet_len)
        buffer = io.BytesIO(data)
        packet_id = read_varint(buffer)
        if packet_id != 0x00:
            raise ValueError("Expected Login Start")
        username = buffer.read(read_varint(buffer)).decode()
        print(f"[<] Login Start from {username}")

        # Step 3: Send Encryption Request
        conn.sendall(create_encryption_request_packet(public_key, verify_token))
        print("[>] Sent Encryption Request")

        # Step 4: Read Encryption Response
        packet_len = read_varint(conn)
        data = conn.recv(packet_len)
        buffer = io.BytesIO(data)
        packet_id = read_varint(buffer)
        shared_secret = private_key.decrypt(buffer.read(read_varint(buffer)), padding.PKCS1v15())
        received_token = private_key.decrypt(buffer.read(read_varint(buffer)), padding.PKCS1v15())
        if received_token != verify_token:
            raise ValueError("Verify token mismatch")

        # Step 5: Mojang session verification
        server_hash = generate_server_hash("", shared_secret, public_key.public_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ))
        response = requests.get("https://sessionserver.mojang.com/session/minecraft/hasJoined", params={
            "username": username,
            "serverId": server_hash
        })
        response.raise_for_status()
        profile = response.json()
        uuid = profile["id"]
        print(f"[+] Verified session with Mojang. UUID: {uuid}")

        # Step 6: Enable AES encryption
        enc_sock = EncryptedSocket(conn, shared_secret)

        # Step 7: Set Compression
        enc_sock.send_packet(create_set_compression_packet(256))
        print("[>] Sent Set Compression")

        # Step 8: Login Success
        enc_sock.send_packet(create_login_success_packet(uuid, username))
        print("[>] Sent Login Success")

        # Step 9: Login Phase Packets
        read_login_phase_packets(enc_sock)

        # Step 10: Feature Flags
        enc_sock.send_packet(create_feature_flags_packet())
        print("[>] Sent Feature Flags")

        # Step 11: Known Packs
        enc_sock.send_packet(create_clientbound_known_packs())
        print("[>] Sent Clientbound Known Packs")

        # Step 12: Receive Serverbound Known Packs
        read_serverbound_known_packs(enc_sock)

        # Step 13: Registry Data
        enc_sock.send_packet(create_registry_data_packet())
        print("[>] Sent Registry Data")

    except Exception as e:
        print(f"[!] Error handling client: {e}")
    finally:
        conn.close()


# --------------------
# Main Server Loop
# --------------------
def main():
    host, port = "0.0.0.0", 25565
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=1024)
    public_key = private_key.public_key()
    verify_token = generate_safe_token(4)

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
        server.bind((host, port))
        server.listen()
        print(f"[*] Listening on {host}:{port}")
        while True:
            conn, addr = server.accept()
            handle_client(conn, addr, private_key, public_key, verify_token)

if __name__ == "__main__":
    main()
