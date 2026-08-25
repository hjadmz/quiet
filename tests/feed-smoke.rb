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

# Jekyll writes UTF-8. File.read decodes with the machine's locale instead, so on a
# box where default_external is US-ASCII every match against these files raises
# "invalid byte sequence" — a real crash that CI hid by exporting LANG=C.UTF-8.
def read_utf8(path)
  File.read(path, encoding: "UTF-8")
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
feed = REXML::Document.new(read_utf8(feed_path))
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

sitemap = REXML::Document.new(read_utf8(sitemap_path))
sitemap_locations = REXML::XPath.match(sitemap, "//*[local-name()='loc']").map(&:text)
assert(sitemap_locations.none? { |location| URI.parse(location).path.end_with?("/feed.xml") },
  "feed.xml must stay out of sitemap.xml")

home = read_utf8(home_path)
assert(home.include?(%(href="#{self_url}")), "feed discovery metadata disagrees with feed self URL")
footer_href = home.match(/<a href="([^"]*\/feed\.xml)">rss<\/a>/)&.[](1)
assert(footer_href, "footer RSS link is missing")
footer_url = URI.join(alternate_url, footer_href).to_s
assert(footer_url == self_url, "footer RSS link disagrees with feed self URL")

# The feed template is vendored from jekyll-feed so it can be edited; this keeps that
# copy honest. Explanatory Liquid comments are stripped before comparing, so documenting
# a decision in place never counts as drift — only changed code does. Each code change
# is declared below with the reason it exists, and a jekyll-feed upgrade that removes
# one of these anchors fails naming the deviation that no longer applies rather than
# printing a whole-file mismatch nobody can read.
def strip_liquid_comments(text)
  # Consume the comment's own indentation too, or it lands on the following line.
  text.gsub(/^[ \t]*\{%-?\s*comment\s*-?%\}.*?\{%-?\s*endcomment\s*-?%\}[ \t]*\n?/m, "")
end

source_body = read_utf8(File.expand_path("../feed.xml", __dir__)).sub(/\A---\n.*?\n---\n/m, "")
source_body = strip_liquid_comments(source_body).sub(/^\{%- include config\.html -%\}\n/, "")
assert(source_body != read_utf8(File.expand_path("../feed.xml", __dir__)),
  "feed.xml must include config.html before it prints q_lang or q_author")

gem = Gem::Specification.find_by_name("jekyll-feed")
upstream = strip_liquid_comments(read_utf8(File.join(gem.full_gem_path, "lib/jekyll-feed/feed.xml")))

DEVIATIONS = [
  ["validated language attribute — an unvalidated quote here closes xml:lang and the " \
   "feed stops parsing for every subscriber at once",
   %q(<feed xmlns="http://www.w3.org/2005/Atom" {% if site.lang %}xml:lang="{{ site.lang }}"{% endif %}>),
   %q(<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="{{ q_lang | xml_escape }}">)],

  ["validated alternate-link language",
   %q(<link href="{{ '/' | absolute_url }}" rel="alternate" type="text/html" {% if site.lang %}hreflang="{{ site.lang }}" {% endif %}/>),
   %q(<link href="{{ '/' | absolute_url }}" rel="alternate" type="text/html" hreflang="{{ q_lang | xml_escape }}" />)],

  ["feed-level author present only when there is a name — upstream's guard is true for " \
   "author: {name: \"\"}",
   "{% if site.author %}",
   %q({% if q_author != "" %})],

  ["feed-level author name from the validated value — upstream prints the map itself " \
   "when the name is blank",
   %q(<name>{{ site.author.name | default: site.author | xml_escape }}</name>),
   %q(<name>{{ q_author | xml_escape }}</name>)],

  ["entry-level author falls through to the validated name for the same reason",
   "{% assign post_author_name = post_author.name | default: post_author %}",
   "{% assign post_author_name = post_author.name | default: post_author %}\n" + "      {%- if post_author_name.first -%}{% assign post_author_name = q_author %}{%- endif -%}\n      {%- if post_author_name == nil or post_author_name == \"\" -%}{% assign post_author_name = q_author %}{%- endif -%}"],

  ["feed length read through the validator, like every other setting",
   "{% assign posts_limit = site.feed.posts_limit | default: 10 %}",
   "{% assign posts_limit = q_feed_limit %}"],

  ["misplaced Digital Publishing roles removed from entry content (axe flags them on " \
   "kramdown's footnote wrappers; the links keep their semantics)",
   "{{ post.content | strip }}",
   %q({{ post.content | strip | replace: ' role="doc-noteref"', '' | replace: ' role="doc-endnote"', '' }})]
].freeze

expected = upstream.dup
DEVIATIONS.each do |name, from, to|
  assert(expected.include?(from),
    "jekyll-feed #{gem.version} no longer contains the text the deviation " \
    "\"#{name}\" replaces. Re-vendor feed.xml from the new upstream and re-apply it.")
  expected = expected.sub(from, to)
end

if source_body != expected
  pair = source_body.lines.zip(expected.lines).each_with_index.find { |(a, b), _| a != b }
  assert(false, "vendored feed template drifted from jekyll-feed #{gem.version} plus its " \
    "#{DEVIATIONS.length} declared deviations, first at line #{pair ? pair[1] + 1 : 0}:\n" \
    "  ours:     #{pair ? pair[0][0].inspect : '(file ends)'}\n" \
    "  expected: #{pair ? pair[0][1].inspect : '(file ends)'}")
end

puts "PASS Atom feed: #{entries.length} full-content entries, canonical links, " \
     "#{DEVIATIONS.length} declared deviations from jekyll-feed #{gem.version}"
