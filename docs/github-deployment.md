# GitHub Desktop and GitHub Pages

The folder is a static site. All browser paths are relative and support `https://USERNAME.github.io/REPOSITORY/`. No Xcode, npm build, API keys or backend are required.

1. Complete the manual content and image-rights review described in the reports and `references/image-attributions.md`. Do not publish uncleared third-party imagery. The local study copy retains every source page; a public release needs an asset-specific clearance decision.
2. In GitHub Desktop choose **File → Add Local Repository** and select this project folder. If it is not a repository, choose **create a repository here**. Keep `index.html` at the repository root.
3. Review the included files. The original 260.6-MB handbook PDF, local Python environments and temporary extraction caches are intentionally absent. The small official addendum is included as a separately attributed source.
4. Commit locally. Select **Publish repository** only when you have decided on the repository's visibility and cleared content rights. A public repository exposes all committed source and images. Private repository Pages availability depends on the GitHub plan.
5. On GitHub, open **Settings → Pages**. Choose **Deploy from a branch**, then your branch (normally `main`) and **/(root)**. Save and wait for GitHub's deployment to finish.
6. Open the Pages URL GitHub provides. Test Home, chapter switching, Learn, a figure, search, Exams and Progress at the repository URL. The `.nojekyll` file prevents unnecessary processing.
7. On iPhone Safari, open the HTTPS Pages URL and use **Share → Add to Home Screen**. Download a chapter in Learn before disconnecting. Reopen it in airplane mode.

No automated deployment workflow is included. Nothing publishes on its own.

## Updating the app

Use stable lesson IDs to keep existing progress. Change the service worker's release version when updating shell files. New content paths should stay relative. Test at a repository subdirectory, not only at a domain root. Back up progress before changing content editions or clearing Safari website data.

## Offline troubleshooting

The service worker needs HTTPS or localhost. A chapter is marked downloaded only after every required file has been cached successfully. Interrupted downloads can be retried; an uncached chapter displays an offline error with a retry action. Cache eviction is controlled by the browser. Export progress regularly; downloaded content and personal progress are separate.
