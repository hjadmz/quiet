---
layout: page
title: about
permalink: /about/
description: what the quiet Jekyll template is designed to do.
---

quiet is a minimal Jekyll blog template designed around the act of
reading: one measured column, familiar links, no tracking, and no
interface competing with the text.

{%- comment -%}
  Conditional because it is a claim about the reader, and a claim that stops
  being true the moment analytics is switched on is worse than no claim. It
  checks the actual include rather than a setting, so it cannot drift from what
  the page really loads.
{%- endcomment -%}
{%- capture _analytics %}{% include analytics.html %}{% endcapture -%}
{%- if _analytics contains "<script" or _analytics contains "<img" or _analytics contains "<iframe" -%}
this site uses an analytics service, so some requests go to a third party. the
only thing quiet itself keeps on your device is which theme you picked, and
clearing your browser data removes it.
{%- else -%}
this site has no analytics, no cookies, and makes no request to anyone else —
every byte comes from this domain. the only thing kept on your device is which
theme you picked, and clearing your browser data removes it.
{%- endif -%}

there is no comment box and nothing to click to show approval. if something here
is wrong, or useful, the reply channel is email — set `footer.email` in
`_config.yml` and it appears in the footer, and under every post.

this hosted copy is a demo. delete the sample posts in `_posts/` and
rewrite this page with your own words. the
[source](https://github.com/hjadmz/quiet) includes the design rationale,
acceptance checks, and instructions for replacing this page with your own.
