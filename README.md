### BeatPeggiator 2.0. A scripter plugin for Logic Pro.

BeatPeggiator is under active development. Feel free to reach out with feature requests and bug reports at michaelcaterisano.com.

#### Installation:

Open Logic Pro and create a new software instrument track. Add the Scripter plugin to the track. Open Scripter, and click the "Open Script in Editor" button. Delete the code, then paste in the code from the file [Beatpeggiator.js](https://github.com/michaelcaterisano/BeatPeggiator/blob/master/BeatPeggiator.js). Hit the `Run Script` button. Don't forget to hit `Run Script`, otherwise the code will not run! Close the Editor, then choose "Save as" from the Scripter dropdown menu name choose a name (I recommend "BeatPeggiator"). Now BeatPeggiator will be available as a preset in the Scripter plugin in all of your Logic projects.

#### Description:

BeatPeggiator creates rhythms using the MIDI notes that are currently playing in the piano roll. It does this using three main parameters:

#### Main Parameters:

`Beats` represents the number of beats (or metronome clicks) over which BeatPeggiator will play rhythms.

`Beat division` represents the number of equal parts `Beats` will be divided into.

`Number of notes` represents the number of beat divisions that will be played over the `Beats`.

#### Additional Parameters:

`Note Order` which has three options: up, down, and random. This controls the order in which notes are played.

`Simultaneous Notes`, which controls how many notes are played at once.

`Note Length` which controls the length of each note played.

`Random Length` which introduces some randomness to the note lengths.

`Random Delay` which causes notes to be delayed by a random amount.

#### Settings Examples:

`Beats` : 1
`Beat Division` : 4
`Number of notes` : 3

Every beat, BeatPeggiator will play 3 notes in a 4 subdivision, or three 16th notes every beat.

`Beats` : 5
`Beat Division`: 3
`Number of notes` : 3

Every five beats, BeatPeggiator will play three equally spaced notes, or a 3 : 5 polyrhythm.

#### Deeper dive:

On a keyboard or in the piano roll, hold down some notes. Ex: C3 E3 G3.

`Active Notes`: C3, E3, G3.

`Beat division`: 4

`Number of notes`: 2

`Beats`: 1

`Simultaneous notes`: 1

For each beat, a beat map is generated based on the Beat Division and Number of notes. With these example values, a beat map could be the following, with a note represented by a 1 and a rest represented by a 0:

```
[1, 1, 0, 0]
[1, 0, 1, 0]
[1, 0, 0, 1]
[0, 1, 1, 0]
[0, 1, 0, 1]
[0, 0, 1, 1]
```

The beat map is then used to trigger a randomly chosen note from `Active Notes`, so a given beat could be:

```
[C3, E3, rest, rest]
[G3, rest, C3, rest]
```

or any other combination of `Active Notes`.
