# Editing johannacampos.com

## Changing words and pictures

Go to **https://johannacampos.com/admin** and log in with GitHub.

- **Pages**: Home, How I Can Help (which also feeds the home page service cards), About, Contact.
- **Pages → Chat**: the scripted chat on the test home page at johannacampos.com/v2 (greeting, questions, answers, buttons). It isn't AI; visitors only see the answers you write. /v2 is hidden from search engines and not linked from the site. Its **Leave me a note** option emails you through the same Formspree form as the Contact page.
- **Pages → Book a call**: the short form at johannacampos.com/book.html that every Book Now button opens. Answers are emailed to you through the same Formspree form as the Contact page (subject “New call request”), then the visitor goes on to your Calendly with their name and email filled in. The service checkboxes come from How I Can Help and the “How did you hear about me?” choices from Contact.
- **Work**: the case-study cards on the home page (title, tags, thumbnail, order).
- **Case studies**: text, tags and images for each case study.
- **Site settings**: Calendly link (where the Book a call form sends people), LinkedIn, email, footer band, copyright.

Press **Publish → Publish now**. The site updates in about a minute.

Text tips:
- Leave a blank line between paragraphs.
- `**double asterisks**` make text bold. In the home page North Star quote they add the orange underline instead, and in the CancerCompass quote they turn the words orange.
- In headings, pressing Return adds a line break.
- To hide How I Can Help's "What you get" section for a service, leave its list empty.

Images keep their position and size on the page, so replace a picture with one of a similar shape.

## What the CMS can't do

Layouts, colours and new sections are in code: `src/*.njk` (page layouts), `assets/css/site.css`, and `assets/js/site.js`. Adding a new case study also needs a new page template.

## How it fits together

- `src/_data/*.yml`: all page copy. This is what the CMS edits.
- `src/*.njk` and `src/_includes/`: page layouts, plus the shared nav, footer band and footer.
- `src/admin/`: the CMS ([Sveltia CMS](https://sveltiacms.app), which uses the Decap CMS config format) and its field definitions (`config.yml`).
- Netlify runs `npm run build` (Eleventy), which writes the finished site to `_site/`. Only `_site/` is published, so working files in this folder stay private.

Run it locally:

```
npm install
npm start          # site at http://localhost:8080
```

To edit local files without logging in, open http://localhost:8080/admin in Chrome, choose **Work with Local Repository**, and pick this folder.
