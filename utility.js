function tempoToMs(tempo) {
  return tempo / 60000;
}

function getAcceleration(time0, time1, tempo0, tempo1) {
  return (tempo1 - tempo0) / (time1 - time0);
}

function getDistance(a, t) {
  return 0.5 * a * Math.pow(t, 2);
}

function getTime(d, a) {
  return Math.sqrt((2 * d) / a);
}

const a = getAcceleration(0, 1, 60, 90);
