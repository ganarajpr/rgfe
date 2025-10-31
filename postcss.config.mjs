const config = {
  plugins: {
    '@tailwindcss/postcss': {
      config: './tailwind.config.js',
    },
    // Add postcss-preset-env to convert modern CSS, including lab() colors
    'postcss-preset-env': {
      stage: 3, // Use stage 3 features, which includes modern color functions
      features: {
        'nesting-rules': true,
        'custom-media-queries': true,
      },
    },
  },
};

export default config;
