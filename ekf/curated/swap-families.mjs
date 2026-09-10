// Additive discovery metadata, separate from the frozen EKF identity/measurement
// contract. Keys are existing canonical IDs. Family membership never merges data.
export const SWAP_FAMILY_VERSION = 1;
export const SWAP_FAMILIES = Object.freeze({
  'ca7c7370-08f4-4ed8-afbe-a2dbea2c0ad9': 'lateral-raise',
  'c0fd7882-3c9b-4546-8ec5-5da8d64bb3aa': 'lateral-raise',
  'c23dead5-dc07-4397-9695-8e46bfc7c5c5': 'lateral-raise',
  '689831d2-1b33-4f27-b768-6d07bb760318': 'hanging-raise',
  '1b3b15e5-e79e-4deb-aeda-e0eefef61f81': 'hanging-raise'
});
