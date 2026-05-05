// In-memory fallback for AsyncStorage when native module isn't compiled in dev build
const store = {};
module.exports = {
  default: {
    getItem: async (key) => store[key] ?? null,
    setItem: async (key, value) => { store[key] = value; },
    removeItem: async (key) => { delete store[key]; },
    clear: async () => { Object.keys(store).forEach(k => delete store[k]); },
    getAllKeys: async () => Object.keys(store),
    multiGet: async (keys) => keys.map(k => [k, store[k] ?? null]),
    multiSet: async (pairs) => pairs.forEach(([k, v]) => { store[k] = v; }),
    multiRemove: async (keys) => keys.forEach(k => delete store[k]),
  },
};
module.exports.default = module.exports.default;
