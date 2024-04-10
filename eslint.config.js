import globals from 'globals';
import tseslint from 'typescript-eslint';
import eslint from '@eslint/js';

export default tseslint.config(
	eslint.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	{
		languageOptions: {
			globals: globals.browser,
			parserOptions: {
				project: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		ignores: ['static/*'],
		rules: {
			'linebreak-style': ['error', 'unix'],
			'prefer-const': ['error', {'destructuring': 'all'}],
			'quotes': ['error', 'single'],
			'semi': ['error', 'always'],
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-floating-promises': ['error', {'ignoreIIFE': true}],
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unused-vars': ['error', {'args': 'none'}],
			'@typescript-eslint/unbound-method': 'off',
		}
	}
);
