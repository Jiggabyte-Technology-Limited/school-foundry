declare module '*.css';
declare module '*.svg' {
  const content: string;
  export default content;
}
declare module '*.png' {
  const content: string;
  export default content;
}
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.webp';
declare module 'jszip';
declare module '*.mjs';
declare module '*?raw' {
  const content: string;
  export default content;
}
