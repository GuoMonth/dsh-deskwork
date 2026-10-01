export default function beforeBuild() {
  // Production dependencies have already been locked, materialized and verified.
  return false;
}
