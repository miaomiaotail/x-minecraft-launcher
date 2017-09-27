import Vue from 'vue'

export default {
    namespaced: true,
    state: {
        mods: [],
        page: 1,
        pages: 1,
        version: '',
        versions: [],
        filter: '',
        filters: [],
        category: '',
        categories: [],
        loading: false,

        cached: {}, // cached project data
    },
    mutations: {
        update(state, { mods, page, pages, version, versions, filter, filters }) {
            state.mods = mods;
            state.page = page;
            state.pages = pages;
            state.versions = versions;
            state.filters = filters;
            state.version = version;
            state.filter = filter;
        },
        loading(state, loading) {
            state.loading = loading;
        },
        /**
         * 
         * @param {State} state 
         */
        cache(state, { path, cache }) {
            Vue.set(state.cached, path, cache);
        },
        /**
         * @param {State} state 
         */
        cacheDownload(state, { path, downloads, page }) {
            downloads.page = page;
            if (state.cached[path]) {
                if (Object.keys(state.cached[path].downloads).length === 0) {
                    state.cached[path].downloads = downloads;
                } else {
                    state.cached[path].downloads.page = downloads.page;
                    state.cached[path].downloads.pages = downloads.pages;
                    state.cached[path].downloads.files.push(...downloads.files);
                }
            }
        },
    },

    actions: {

        /**
         * 
         * @param {ActionContext} context 
         * @param {string} path 
         * @return {CurseforgeProject}
         * 
         */
        project(context, path) {
            const { dispatch, commit, state } = context;
            if (path === undefined || path == null) return Promise.reject('Path cannot be null');
            if (!state.cached[path]) {
                return dispatch('query',
                    { service: 'curseforge', action: 'project', payload: `/projects/${path}` },
                    { root: true })
                    .then((proj) => { commit('cache', { path, cache: proj }) })
                    .then(() => dispatch('downloads', { path, page: 1 }))
                    .then(() => state.cached[path])
            }
            return Promise.resolve(state.cached[path])
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {{path:string, version:string, page:string}} payload 
         */
        downloads(context, payload) {
            const { dispatch, commit, state } = context;
            const { path, version } = payload;
            const page = payload.page || 1;
            return dispatch('query',
                { service: 'curseforge', action: 'downloads', payload: { path: `/projects/${path}`, version, page } },
                { root: true })
                .then((downloads) => {
                    commit('cacheDownload', { path, downloads, page });
                })
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {{path:string, version:string, filter:string}} payload 
         */
        update(context, payload) {
            const { dispatch, commit, state } = context;
            const filter = payload.filter || state.filter;
            const version = payload.version || state.version;
            const page = payload.page || state.page;
            commit('loading', true)
            return dispatch('query', {
                service: 'curseforge',
                action: 'mods',
                payload: { page, version, sort: filter },
            }, { root: true })
                .then((s) => {
                    commit('update', {
                        mods: s.mods,
                        page,
                        pages: s.pages,
                        filter,
                        filters: s.filters,
                        version,
                        versions: s.versions,
                    })
                    commit('loading', false)
                })
        },
    },

}
