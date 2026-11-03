# Publish the static notebook

Run `npm test` and `npm run check:secrets`. Upload the generated `dist/` folder to a static host, or push the approved source to `main` to use the existing GitHub Pages workflow. Its URL remains `https://mikemfleming.github.io/seahawk/`.

No secrets, databases, Supabase functions, auth settings, or environment variables are required. The HTML uses relative photo and stylesheet paths, so it can be hosted at the domain root or a subdirectory.

All text and display photographs are bundled into the site and will be public when published. Review the complete page before deployment, including contact details photographed in the logbook. Full-resolution source exports and recovery copies stay under ignored `data/` and are not deployment inputs.

The former Supabase archive remains untouched for recovery. Removing its remote infrastructure is a separate decision; this website never contacts it.

## Local editing

Use `npm start` for the loopback-only editing server; `npm run preview` is read-only. Commit `content/corrections.json` to publish approved corrections and notes. Local editor code lives in `local/`, outside the `web/` files copied into the Pages artifact.
