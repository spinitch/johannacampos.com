// Builds the site from src/ into _site/. Page copy lives in src/_data/*.yml,
// which is what the CMS at /admin edits; the .njk files hold the layout.
import { load as loadYaml } from "js-yaml";
import markdownIt from "markdown-it";

// breaks: a single Return in the CMS is a line break; a blank line starts a new paragraph.
const md = markdownIt({ html: true, breaks: true });

// Links written in the CMS get the site's coral underline style.
const defaultLinkOpen = md.renderer.rules.link_open ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx].attrJoin("class", "text-link");
  return defaultLinkOpen(tokens, idx, options, env, self);
};

const escapeHtml = (s) => md.utils.escapeHtml(String(s ?? ""));

// Keep the last two words together so headings don't end on a lone word.
const noWidow = (html) => html.replace(/ (\S+)$/, "&nbsp;$1");

export default function (eleventyConfig) {
  eleventyConfig.addDataExtension("yml", (contents) => loadYaml(contents));

  // Scripted chat data for assets/js/chat.js. Each blank-line-separated
  // paragraph of an answer becomes its own bubble.
  eleventyConfig.addFilter("chatJson", (chat, site) => {
    const bubbles = (s) => String(s ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
      .map((p) => md.renderInline(p).replace(/\n/g, ""));
    const data = {
      greetings: chat.greetings,
      opening: bubbles(chat.opening),
      more: bubbles(chat.more_prompt),
      done: bubbles(chat.done_prompt),
      restart: chat.restart_label,
      avatar: String(chat.avatar ?? ""),
      book: { label: chat.book_label, url: site.booking_url },
      note: chat.note && {
        ...chat.note,
        ask_name: bubbles(chat.note.ask_name),
        ask_about: bubbles(chat.note.ask_about),
        ask_email: bubbles(chat.note.ask_email),
        ask_message: bubbles(chat.note.ask_message),
        thanks: bubbles(chat.note.thanks),
        error: bubbles(chat.note.error).map((h) => h.replace("{email}",
          `<a href="mailto:${escapeHtml(site.contact_email)}">${escapeHtml(site.contact_email)}</a>`)),
        // Same Formspree form as the Contact page.
        endpoint: "https://formspree.io/f/myeygrkk",
      },
      topics: (chat.topics ?? []).map((t) => ({
        question: t.question,
        answer: bubbles(t.answer),
        buttons: (t.buttons ?? []).map((b) => ({ label: b.label, url: b.link })),
        book: Boolean(t.book),
      })),
    };
    // Safe inside <script>: no "</script>" or HTML comment openers survive.
    return JSON.stringify(data).replace(/</g, "\\u003c");
  });

  // Pages in subfolders (/v2/, /v3/) share templates written with relative links,
  // so point those links at the site root instead.
  eleventyConfig.addTransform("rootLinks", function (content) {
    if (!(this.page.outputPath || "").match(/\/v\d+\//)) return content;
    return content.replace(/\b(href|src)="(?![a-z]+:|\/|#)/g, '$1="/');
  });

  // Paragraphs, lists, bold, links.
  eleventyConfig.addFilter("md", (s) => md.render(String(s ?? "")));
  // A single line: bold, italics, links, no <p> wrapper.
  eleventyConfig.addFilter("mdi", (s) => md.renderInline(String(s ?? "").trim()));
  // Headings: a new line in the CMS becomes a line break.
  eleventyConfig.addFilter("heading", (s) => noWidow(md.renderInline(String(s ?? "").trim())));
  // **words** become <span class="cls">words</span> (orange underline / accent).
  eleventyConfig.addFilter("accent", (s, cls) =>
    md.renderInline(String(s ?? "").trim())
      .replace(/<strong>(.*?)<\/strong>/g, `<span class="${cls}">$1</span>`));
  // "Dissect + Diagnose" -> Dissect <span class="plus">+</span> Diagnose
  eleventyConfig.addFilter("plus", (s) =>
    escapeHtml(s).replace(/ \+ /g, ' <span class="plus">+</span> '));
  eleventyConfig.addFilter("splitPlus", (s) => String(s ?? "").split(/\s+\+\s+/));
  eleventyConfig.addFilter("esc", escapeHtml);
  // The CMS stores images as /assets/img/...; pages link them relatively.
  eleventyConfig.addFilter("asset", (s) => String(s ?? "").replace(/^\//, ""));

  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("hero-photos");
  eleventyConfig.addPassthroughCopy("hero.mp4");
  eleventyConfig.addPassthroughCopy({ "src/admin": "admin" });
  eleventyConfig.ignores.add("src/admin/**");

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    htmlTemplateEngine: "njk",
    templateFormats: ["njk"],
  };
}
