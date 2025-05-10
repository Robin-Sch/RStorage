// Magic to get svg imports to work

declare module '*.svg' {
	const path: string;
	export default path;
}
