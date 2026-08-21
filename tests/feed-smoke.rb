# frozen_string_literal: true

require "rexml/document"
require "rexml/xpath"
require "time"
require "uri"

ROOT = if ENV["SITE_ROOT"]
         File.expand_path(ENV.fetch("SITE_ROOT"))
       else
         File.expand_path("../_site", __dir__)
       end
ATOM = { "a" => "http://www.w3.org/2005/Atom" }.freeze

def assert(condition, message)
  raise message unless condition
end

def text_at(element, xpath)
  node = REXML::XPath.first(element, xpath, ATOM)
  assert(node, "missing feed node: #{xpath}")
  value = node.text.to_s.strip
  assert(!value.empty?, "empty feed node: #{xpath}")
  value
end

feed_path = File.join(ROOT, "feed.xml")
sitemap_path = File.join(ROOT, "sitemap.xml")
home_path = File.join(ROOT, "index.html")
feed = REXML::Document.new(File.read(feed_path))
root = feed.root
assert(root&.name == "feed", "feed.xml needs an Atom feed root")
assert(root.namespace == ATOM["a"], "feed.xml has the wrong Atom namespace")

self_links = REXML::XPath.match(root, "a:link[@rel='self']", ATOM)
assert(self_links.length == 1, "feed needs exactly one self link")
self_url = self_links.first.attributes["href"]
assert(URI.parse(self_url).absolute?, "feed self link must be absolute")
assert(text_at(root, "a:id") == self_url, "feed id and self link must match")
text_at(root, "a:title")
Time.xmlschema(text_at(root, "a:updated"))
text_at(root, "a:author/a:name")

alternate = REXML::XPath.first(root, "a:link[@rel='alternate']", ATOM)
assert(alternate, "feed needs a site alternate link")
alternate_url = alternate.attributes["href"]

if ENV["SITE_URL"]
  origin = ENV.fetch("SITE_URL").sub(%r{/$}, "")
  baseurl = ENV.fetch("SITE_BASEURL", "").sub(%r{/$}, "")
  assert(self_url == "#{origin}#{baseurl}/feed.xml", "feed self URL is not canonical")
  assert(alternate_url == "#{origin}#{baseurl}/", "feed alternate URL is not canonical")
end

entries = REXML::XPath.match(root, "a:entry", ATOM)
entries.each do |entry|
  text_at(entry, "a:title")
  text_at(entry, "a:id")
  Time.xmlschema(text_at(entry, "a:published"))
  Time.xmlschema(text_at(entry, "a:updated"))
  text_at(entry, "a:author/a:name")
  link = REXML::XPath.first(entry, "a:link[@rel='alternate']", ATOM)
  assert(link && URI.parse(link.attributes["href"]).absolute?, "entry link must be absolute")
  content = REXML::XPath.first(entry, "a:content", ATOM)
  assert(content, "each feed entry needs full content")
  assert(content.attributes["type"] == "html", "entry content type must be html")
  assert(URI.parse(content.attributes["xml:base"]).absolute?, "entry xml:base must be absolute")
  html = content.text.to_s
  assert(!html.strip.empty?, "entry content must not be empty")
  assert(!html.include?('role="doc-noteref"'), "feed retains misplaced doc-noteref role")
  assert(!html.include?('role="doc-endnote"'), "feed retains deprecated doc-endnote role")
  if html.include?('class="footnotes"')
    assert(html.include?('role="doc-endnotes"'), "footnote container lost doc-endnotes")
    assert(html.include?('role="doc-backlink"'), "footnote return link lost doc-backlink")
    assert(html.match?(/id="fn:[^"]+"/), "footnote target is missing")
    assert(html.match?(/href="#fnref:[^"]+"/), "footnote backlink target is missing")
  end
end

if ENV["EXPECT_DEMO"] == "1"
  assert(entries.length == 3, "public demo feed must contain its three sample posts")
  joined = entries.map { |entry| REXML::XPath.first(entry, "a:content", ATOM).text.to_s }
    .join("\n").gsub(/\s+/, " ")
  assert(joined.include?("supported post-content set"), "demo feed content is truncated")
  assert(joined.include?("retained automated checks"), "demo feed omitted footnote content")
end

sitemap = REXML::Document.new(File.read(sitemap_path))
sitemap_locations = REXML::XPath.match(sitemap, "//*[local-name()='loc']").map(&:text)
assert(sitemap_locations.none? { |location| URI.parse(location).path.end_with?("/feed.xml") },
  "feed.xml must stay out of sitemap.xml")

home = File.read(home_path)
assert(home.include?(%(href="#{self_url}")), "feed discovery metadata disagrees with feed self URL")
footer_href = home.match(/<a href="([^"]*\/feed\.xml)">rss<\/a>/)&.[](1)
assert(footer_href, "footer RSS link is missing")
footer_url = URI.join(alternate_url, footer_href).to_s
assert(footer_url == self_url, "footer RSS link disagrees with feed self URL")

source = File.read(File.expand_path("../feed.xml", __dir__))
source_body = source.sub(/\A---\n.*?\n---\n/m, "")
gem_path = Gem::Specification.find_by_name("jekyll-feed", "0.17.0").full_gem_path
upstream = File.read(File.join(gem_path, "lib/jekyll-feed/feed.xml"))
expected = upstream.sub(
  "{{ post.content | strip }}",
  %q({{ post.content | strip | replace: ' role="doc-noteref"', '' | replace: ' role="doc-endnote"', '' }})
)
assert(source_body == expected,
  "vendored feed template drifted beyond the documented two-role transform")

puts "PASS Atom feed: #{entries.length} full-content entries, canonical links, role cleanup"
