/*************************************** */

function getAndRemoveRandomItem(arr) {
  if (arr.length !== 0) {
    const index = Math.floor(Math.random() * arr.length);
    return arr.splice(index, 1)[0];
  } else {
    console.log("empty array");
  }
}

function getRhythm(numNotes, notesPerBeat) {
  let arr = new Array(notesPerBeat);
  for (let i = 0; i < notesPerBeat; i++) {
    arr[i] = i;
  }

  let indices = [];
  for (let i = 0; i < numNotes; i++) {
    let index = getAndRemoveRandomItem(arr);
    indices.push(index);
  }
  console.log(indices.sort());

  let output = new Array(notesPerBeat).fill(0);
  for (let i = 0; i < indices.length; i++) {
    let index = indices[i];
    output[index] = 1;
  }
  return output;
}

function getNoteDelays(noteMap) {
  let sum = 0;

  const offsetReducer = (output, curr, index) => {
    switch (true) {
      case index === 0 && curr === 0:
        break;
      case index === 0 && curr === 1:
        output.push(sum);
        break;
      case curr === 0:
        sum += 250;
        break;
      case curr === 1:
        sum += 250;
        output.push(sum);
        sum = 0;
        break;
    }
    return output;
  };

  return noteMap.reduce(offsetReducer, []);
}

const t0 = new Date().getTime();
console.log(getNoteDelays(getRhythm(3, 4)));
const t1 = new Date().getTime();

console.log("time: " + (t1 - t0));

/**************************** */
