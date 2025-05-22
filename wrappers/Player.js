(async function() {
    class Player {
        constructor(world) {
            this.$position = {
                x: 0,
                y: 0,
                z: 0,
                yaw: 0,
                pitch: 0
            };
            this.headRotation = {
                yaw: 0,
                pitch: 0
            }
            this.heldItem = 0;
            this.inventory = [];

            this.world = world;
        }
        /**
         * @param {Object} pos
         */
        set position(pos) {
            Logger.log("debug", "Player position set to", pos);
            this.world.controls.target.set(pos.x, pos.y, pos.z);
            this.world.camera.position.set(pos.x, pos.y, pos.z);
            // this.world.camera.rotation.set(pos.pitch, pos.yaw, 0);
            this.$position = pos;
        }
    }
    define("Player", Player);
})();