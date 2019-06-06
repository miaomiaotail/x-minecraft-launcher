import Vue from 'vue';
import { fitin } from '../../utils/object';

/**
 * @type {import('./profile').ProfileModule}
 */
const mod = {
    dependencies: ['java', 'version', 'version/minecraft', 'user'],
    namespaced: true,
    state: {
        all: {},
        id: '',
    },
    getters: {
        profiles: state => Object.keys(state.all).map(k => state.all[k]),
        ids: state => Object.keys(state.all),
        current: state => state.all[state.id],
    },
    mutations: {
        create(state, profile) {
            /**
             * Prevent the case that hot reload keep the vuex state
             */
            if (!state.all[profile.id]) {
                Vue.set(state.all, profile.id, profile);
            }
        },
        remove(state, id) {
            Vue.delete(state.all, id);
        },
        select(state, id) {
            if (state.all[id]) {
                state.id = id;
            } else if (state.id === '') {
                state.id = Object.keys(state.all)[0];
            }
        },
        edit(state, settings) {
            const prof = state.all[state.id];

            prof.name = settings.name || prof.name;
            prof.author = settings.author || prof.author;
            prof.description = settings.description || prof.description;

            prof.mcversion = settings.mcversion || prof.mcversion;

            prof.minMemory = settings.minMemory || prof.minMemory;
            prof.maxMemory = settings.maxMemory || prof.maxMemory;
            prof.java = settings.java || prof.java;

            if (prof.java && !prof.java.path) {
                Reflect.deleteProperty(prof, 'java');
            }

            prof.version = settings.version || prof.version;

            prof.type = settings.type || prof.type;

            if (settings.server) {
                prof.server.host = settings.server.host || prof.server.host;
                prof.server.port = settings.server.port || prof.server.port;
            }

            if (typeof settings.forceVersion === 'boolean') {
                prof.forceVersion = settings.forceVersion;
            }
            if (typeof settings.showLog === 'boolean') {
                prof.showLog = settings.showLog;
            }
            if (typeof settings.hideLauncher === 'boolean') {
                prof.hideLauncher = settings.hideLauncher;
            }
        },

        maps(state, maps) {
            state.all[state.id].maps = maps;
        },

        gamesettings(state, settings) {
            fitin(state.all[state.id].settings, settings);
        },

        forge(state, { enabled, mods, version }) {
            const forge = state.all[state.id].forge;
            if (typeof enabled === 'boolean') {
                forge.enabled = enabled;
            }
            if (mods instanceof Array) {
                forge.mods = mods;
            }
            if (typeof version === 'string') {
                forge.version = version;
            }
        },
    },
};

export default mod;