from hashlib import sha1

pub_key = None
with open("examples/pub_key.bin", "rb") as f:
    pub_key = f.read()

def generate_verification_hash(server_id, shared_secret, public_key):
    verification_hash = sha1()

    verification_hash.update(server_id.encode('utf-8'))
    verification_hash.update(shared_secret)
    verification_hash.update(public_key)

    return minecraft_sha1_hash_digest(verification_hash)


def minecraft_sha1_hash_digest(sha1_hash):
    # Minecraft first parses the sha1 bytes as a signed number and then
    # spits outs its hex representation
    number_representation = _number_from_bytes(sha1_hash.digest(), signed=True)
    return format(number_representation, 'x')

def _number_from_bytes(b, signed=False):
    try:
        return int.from_bytes(b, byteorder='big', signed=signed)
    except AttributeError:  # pragma: no cover
        # py-2 compatibility
        if len(b) == 0:
            b = b'\x00'
        num = int(str(b).encode('hex'), 16)
        if signed and (ord(b[0]) & 0x80):
            num -= 2 ** (len(b) * 8)
        return num

print(generate_verification_hash(u"", b"secret", pub_key),"==","1f142e737a84a974a5f2a22f6174a78d80fd97f5")
print(generate_verification_hash("-5fc4dccecf3cb4b9", bytearray([150,157,167,210,15,187,45,113,234,199,73,228,135,218,82,211]), bytearray([48,129,159,48,13,6,9,42,134,72,134,247,13,1,1,1,5,0,3,129,141,0,48,129,137,2,129,129,0,181,210,248,110,97,0,123,49,85,229,208,131,43,114,29,85,154,27,184,16,169,46,80,90,15,167,120,185,125,175,12,28,46,228,233,133,140,13,125,231,74,60,224,112,48,218,210,247,208,12,46,33,74,58,108,6,113,77,64,207,172,48,36,233,25,203,254,163,23,63,150,212,175,221,72,7,22,59,149,193,169,10,11,251,147,247,118,48,15,230,170,230,79,152,5,117,88,230,236,31,115,16,255,18,110,148,95,79,247,221,151,91,85,49,240,182,88,177,87,145,77,63,32,159,128,191,96,69,2,3,1,0,1])))