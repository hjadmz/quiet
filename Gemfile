# Used by local preview, CI, and static hosts that build the site.
source "https://rubygems.org"
ruby "~> 3.3.0"

gem "github-pages", group: :jekyll_plugins
gem "webrick" # required by `jekyll serve` on Ruby 3+

# Windows ships no zoneinfo database, so `timezone:` in _config.yml has nothing to
# read and Jekyll fails the build outright rather than falling back to UTC. Shipping
# the data as a gem on Windows only keeps every other platform's lockfile unchanged.
gem "tzinfo-data", platforms: [:windows, :jruby]
