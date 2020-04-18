//-----------------------------------------------------------------------------
// Simple Arpeggiator
//-----------------------------------------------------------------------------
/*	
		Held notes are tracked in a global array in the HandleMIDI() callback.
		Notes are chosen and played back during the ProcessMIDI() callback.
*/

var NeedsTimingInfo = true;
var activeNotes = [];
var currentPosition = 0;
var beatMap = [];
var delays = [];
var beatPositions = [];
var newBeat = true;
var manualActiveNotes = [];

var state = {
  BEAT: null,
  start: null,
  end: null,
  beatMap: null,
  //delays: delays.map(delay => delay.toFixed(2)),
  pos: null,
  curPos: null,
  noteInSlice: null,
};

function Reset() {
  activeNotes = [];
  currentPosition = 0;
  beatMap = [];
  delays = [];
  beatPositions = [];
  newBeat = true;
  manualActiveNotes = [];
}

function HandleMIDI(event) {
  var musicInfo = GetTimingInfo();

  if (event instanceof NoteOn) {
    // add note to array
    activeNotes.push(event);
  } else if (event instanceof NoteOff) {
    // remove note from array
    for (i = 0; i < activeNotes.length; i++) {
      if (activeNotes[i].pitch == event.pitch) {
        activeNotes.splice(i, 1);
        break;
      }
    }
  }

  if (activeNotes.length === 0) {
    Reset();
  }
  // pass non-note events through
  //else event.send();

  // sort array of active notes
  activeNotes.sort(sortByPitchAscending);
}

//-----------------------------------------------------------------------------
function sortByPitchAscending(a, b) {
  if (a.pitch < b.pitch) return -1;
  if (a.pitch > b.pitch) return 1;
  return 0;
}

//-----------------------------------------------------------------------------
var wasPlaying = false;

function ProcessMIDI() {
  // Get timing information from the host application
  var musicInfo = GetTimingInfo();

  // clear activeNotes[] when the transport stops and send any remaining note off events
  if (wasPlaying && !musicInfo.playing) {
    for (i = 0; i < activeNotes.length; i++) {
      var off = new NoteOff(activeNotes[i]);
      off.send();
    }
  }

  wasPlaying = musicInfo.playing;

  if (activeNotes.length != 0 && musicInfo.playing) {
    // get parameters
    var division = GetParameter("Beat Division");
    var numBeats = GetParameter("Num Beats");
    // var noteOrder = GetParameter("Note Order");
    var noteLength = (GetParameter("Note Length") / 100) * (1 / division);
    var randomLength =
      Math.random() * ((GetParameter("Random Length") / 100) * (1 / division));
    var randomDelay =
      Math.random() * ((GetParameter("Random Delay") / 100) * (1 / division));

    // calculate beat to schedule
    var lookAheadEnd = musicInfo.blockEndBeat;

    // calculate new positions if new beat
    if (newBeat) {
      Trace("--------------------");
      manualActiveNotes = [...activeNotes];
      beatMap = generateBeatMap(numBeats, division);
      delays = generateNoteDelays(beatMap, 1 / division);
      beatPositions = getBeatPositions();
      newBeat = false;
    }

    var nextBeat = beatPositions[currentPosition];

    // when cycling, find the beats that wrap around the last buffer
    if (musicInfo.cycling && lookAheadEnd >= musicInfo.rightCycleBeat) {
      if (lookAheadEnd >= musicInfo.rightCycleBeat) {
        beatPositions = delays.map((delay) => {
          return musicInfo.leftCycleBeat + delay;
        });
        var cycleBeats = musicInfo.rightCycleBeat - musicInfo.leftCycleBeat;
        var cycleEnd = lookAheadEnd - cycleBeats;
      }
    }

    // loop through the beats that fall within this buffer
    while (
      (nextBeat >= musicInfo.blockStartBeat && nextBeat < lookAheadEnd) ||
      // including beats that wrap around the cycle point
      (musicInfo.cycling && nextBeat < cycleEnd)
    ) {
      // adjust for cycle
      if (musicInfo.cycling && nextBeat >= musicInfo.rightCycleBeat) {
        nextBeat -= cycleBeats;
        // wrap beatPositions around cycle
        beatPositions = delays.map((delay) => {
          return musicInfo.leftCycleBeat + delay;
        });
      }

      sendNote(nextBeat, randomDelay);
      if (numBeats === 1) {
        newBeat = true;
        break;
      }

      // advance to next beat
      nextBeat += 0.001;

      // if position out of bounds, reset and break
      if (currentPosition >= delays.length - 1) {
        currentPosition = 0;
        //beatPositions = getBeatPositions();
        newBeat = true;
        //nextBeat = beatPositions[currentPosition];
        break;
      } else {
        currentPosition += 1;
        nextBeat = beatPositions[currentPosition];
      }
    }
  }
}

//-----------------------------------------------------------------------------
function getBeatPositions(nextBeat) {
  var musicInfo = GetTimingInfo();
  var positions = [];
  positions = delays.map((delay) => {
    // left of cycle
    if (
      musicInfo.blockStartBeat < musicInfo.leftCycleBeat ||
      currentPosition === 0
    ) {
      return Math.ceil(musicInfo.blockStartBeat) + delay;
    } else if (musicInfo.cycling && nextBeat >= musicInfo.rightCycleBeat) {
      return musicInfo.leftCycleBeat + delay;
    } else {
      return Math.floor(musicInfo.blockStartBeat) + delay;
    }
  });
  Trace("GET POSITIONS: [" + positions + "]");
  return positions;
}

function sendNote(nextBeat, randomDelay) {
  Trace("SEND");
  var info = GetTimingInfo();
  var availableNotes = [...manualActiveNotes];
  var division = GetParameter("Beat Division");
  var noteLength = (GetParameter("Note Length") / 100) * (1 / division);
  var randomLength =
    Math.random() * ((GetParameter("Random Length") / 100) * (1 / division));

  if (availableNotes.length !== 0) {
    var simultaneousNotes = GetParameter("Simultaneous Notes");
    var iterations =
      simultaneousNotes > manualActiveNotes.length
        ? manualActiveNotes.length
        : simultaneousNotes;
    Trace("iterations: " + iterations);
    for (var i = 0; i < iterations; i++) {
      var selectedNote = getAndRemoveRandomItem(availableNotes);

      var noteToSend = new NoteOn();
      noteToSend.pitch = selectedNote.pitch;
      noteToSend.sendAtBeat(nextBeat + randomDelay);
      Trace(
        "NOTE: " +
          selectedNote.pitch +
          " | BEAT: " +
          nextBeat +
          " | POSITIONS: [" +
          beatPositions +
          "]"
      );

      noteOffToSend = new NoteOff(noteToSend);
      noteOffToSend.sendAfterMilliseconds(
        (noteLength + randomLength) * (60000 / info.tempo)
      );
    }
  }
}

//-----------------------------------------------------------------------------
// var noteOrders = ["up", "down", "random"];

// function chooseNote(noteOrder, step) {
//   var order = noteOrders[noteOrder];
//   var length = activeNotes.length;
//   if (order == "up") return activeNotes[step % length];
//   if (order == "down")
//     return activeNotes[Math.abs((step % length) - (length - 1))];
//   if (order == "random") return activeNotes[Math.floor(Math.random() * length)];
//   else return 0;
// }

//-----------------------------------------------------------------------------
function getAndRemoveRandomItem(arr) {
  if (arr.length !== 0) {
    var index = Math.floor(Math.random() * arr.length);
    return arr.splice(index, 1)[0];
  } else {
  }
}
//-----------------------------------------------------------------------------
function generateBeatMap(numNotes, beatDivision) {
  // create array of size beatDivision and fill with index numbers
  var arr = new Array(beatDivision);
  for (var i = 0; i < beatDivision; i++) {
    arr[i] = i;
  }

  // randomly choose numNotes number of indices from array
  // these will be the beatDivisions that have a note
  var indices = [];
  for (var i = 0; i < numNotes; i++) {
    var index = getAndRemoveRandomItem(arr);
    indices.push(index);
  }

  // create output array like [1, 0, 1, 1] where 1 represents a note
  // 0 represents a rest, and the array length represents the number of
  // beat divisions
  var output = new Array(beatDivision).fill(0);
  for (var i = 0; i < indices.length; i++) {
    var index = indices[i];
    output[index] = 1;
  }
  return output;
}

//-----------------------------------------------------------------------------
// returns array of note delays in milliseconds,
//e.g. [0, 255, 255, 255] for beatmap [1, 1, 1, 1] at 60bpm
function generateNoteDelays(beatMap, offsetAmount) {
  var output = [];

  for (var i = 0; i < beatMap.length; i++) {
    if (beatMap[i] === 1) {
      output.push(offsetAmount * i);
    }
  }

  return output;
}
//-----------------------------------------------------------------------------
function ParameterChanged(param, value) {
  var musicInfo = GetTimingInfo();
  if (param === 0) {
    // Beat Division
    if (value < GetParameter("Num Beats")) {
      SetParameter(1, value);
    } else {
    }
  }
  if (param === 1) {
    if (value === 1) {
      beatPositions = delays.map((delay) => {
        return Math.ceil(musicInfo.blockStartBeat) + delay;
      });
      currentPosition = 0;
      nextBeat = beatPositions[currentPosition];
    }
    if (value > GetParameter("Beat Division")) {
      SetParameter("Beat Division", value);
    }
  }
  if (param === 2) {
  }
}
//-----------------------------------------------------------------------------
var PluginParameters = [
  {
    name: "Beat Division",
    type: "linear",
    minValue: 1,
    maxValue: 16,
    numberOfSteps: 15,
    defaultValue: 4,
  },
  {
    name: "Num Beats",
    type: "linear",
    minValue: 1,
    maxValue: 16,
    numberOfSteps: 15,
    defaultValue: 4,
  },

  {
    name: "Simultaneous Notes",
    type: "lin",
    minValue: 1,
    maxValue: 16,
    numberOfSteps: 15,
    defaultValue: 1,
  },

  {
    name: "Note Length",
    unit: "%",
    type: "linear",
    minValue: 1,
    maxValue: 200,
    defaultValue: 100.0,
    numberOfSteps: 199,
  },

  {
    name: "Random Length",
    unit: "%",
    type: "linear",
    minValue: 0,
    maxValue: 200,
    numberOfSteps: 200,
    defaultValue: 0,
  },

  {
    name: "Random Delay",
    unit: "%",
    type: "linear",
    minValue: 0,
    maxValue: 200,
    numberOfSteps: 200,
    defaultValue: 0,
  },
];
