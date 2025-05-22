(function () {
    const requireMap = {}
    window.require = async function(name) {
        if (requireMap[name]?.value) {
            return requireMap[name].value
        }
        return new Promise((resolve) => {
            requireMap[name] = requireMap[name] || { resolve: [] }
            requireMap[name].resolve.push(resolve)
        })
    }
    window.define = function(name, value) {
        requireMap[name] = requireMap[name] || { resolve: [] }
        requireMap[name].value = value
        for (const resolve of requireMap[name].resolve) {
            resolve(value)
        }
        requireMap[name].resolve = []
    }
})()