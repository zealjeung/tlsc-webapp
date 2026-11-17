#!/usr/bin/env bash
# deploy-tlsc.sh — rebuild the TL SC static snapshot and push the gh-pages branch
# so GitHub Pages picks up the latest data. Run every ~10 min from a scheduler.
set -u
cd "C:/Users/wretr/AppData/Local/hermes/workspace/tlsc-webapp" || { echo "cannot cd"; exit 1; }
echo "CWD: $(pwd)"

echo ">>> Baking snapshot ..."
node tlsc-snapshot.js
if [ $? -ne 0 ]; then echo "Bake FAILED"; exit 1; fi

echo ">>> Switching to gh-pages branch and pushing snapshot ..."
git checkout -q gh-pages 2>/dev/null || git checkout -b gh-pages origin/gh-pages
# Overwrite the site content (flatten site/ onto gh-pages root)
cp -rf site/* . 2>/dev/null || true
# Remove non-site artifacts that were left on this branch
git clean -fdq 2>/dev/null || true
git add -A
if ! git commit -q -m "chrono: snapshot $(date -u +%F)" 2>/dev/null; then
  echo "(nothing to commit)"; 
fi
git push -q origin gh-pages
if [ $? -ne 0 ]; then echo "push FAILED"; exit 1; fi
echo "DEPLOY OK — pushed gh-pages to GitHub Pages"
