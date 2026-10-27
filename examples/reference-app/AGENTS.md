# Working on this VastX Native app

Read STYLING.md before creating or changing UI. Use its native layout and spacing
conventions. This project uses Tailwind v3 with the framework's bundled NativeScript
adapter; do not replace it with a browser Tailwind/v4 setup. Use NFlex with explicit
direction and parent gap for sibling spacing. Keep complete class names in source.
Respect component props and native inline styles; do not stack conflicting spacing
utilities to compensate for layout problems. Test numeric CSS output and report
whether device-level visual verification was performed.
