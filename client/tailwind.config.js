/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic dark-theme tokens. Prefer these over raw gray-* so surfaces
        // line up across pages. Existing gray-* classes still work — migrate
        // opportunistically when touching a file.
        'bs-bg':            '#030712',
        'bs-panel':         '#111827',
        'bs-subpanel':      '#1f2937',
        'bs-border':        '#1f2937',
        'bs-border-strong': '#374151',
        'bs-muted':         '#6b7280',
        'bs-text':          '#f3f4f6',
        'bs-accent':        '#3b82f6',
        'bs-accent-strong': '#2563eb',
        'bs-danger':        '#dc2626',
        'bs-warn':          '#d97706',
        'bs-ok':            '#16a34a',
      },
    },
  },
  plugins: [],
};
