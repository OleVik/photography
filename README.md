# [OleVik.me/Photography](https://olevik.me/photography)

Builds the photography-section of my personal website, pulling in data from Flickr using Node and Gulp. Uses node-flickrapi for data, see `.env.json.example` for configuration - it is renamed to `.env.json` for building using [OAUTH](https://github.com/Pomax/node-flickrapi#an-example-of-a-first-run) for calling the API.

## Gulp Tasks

### Data (`gulp data`)

Accesses Flickr API and retrieves a JSON-output of all relevant images, saved to `app/data.json`.

### Default (`gulp`)

Builds interface from templates, styles, and scripts and saves it to `dist/index.html` with all assets inlined. If `LOCAL_IMAGES` is set to `true` (`false` by default) in `.env.json` the Download-task is run, which saves all images (except originals, which are not used) to `dist/images`, and assigns image-paths to this directory rather than their Flickr-URLs.

MIT License 2017 by [Ole Vik](http://github.com/olevik), all images &copy; [Ole Vik](http://olevik.me/). Design by [HTML5 Up](https://html5up.net/multiverse).
