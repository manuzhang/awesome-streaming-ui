# awesome-streaming-ui ![travis-build](https://api.travis-ci.org/manuzhang/awesome-streaming-ui.svg?branch=master)

Website for [awesome-streaming](https://github.com/manuzhang/awesome-streaming) projects with up-to-date metadata (stars, forks, lastUpdate time, etc).

The metadata is fetched daily by syncing the upstream README and enriching GitHub repository entries through the GitHub REST API in [scripts/sync-repos-metadata.js](./scripts/sync-repos-metadata.js).

This project is built with [vue-cli](https://cli.vuejs.org/), [vuetify](https://vuetifyjs.com) and [github-corners](http://tholman.com/github-corners/), and published to [GitHub pages](https://docs.travis-ci.com/user/deployment/pages/)

## Project setup
```
yarn install
```

### Compiles and hot-reloads for development
```
yarn run serve
```

### Compiles and minifies for production
```
yarn run build
```

### Lints and fixes files
```
yarn run lint
```
