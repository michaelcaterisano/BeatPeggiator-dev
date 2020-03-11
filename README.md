### DrumEggiator. A scripter plugin for Logic Pro.

#### Installation:

Open Logic Pro and create a new track. Add the Scripter plugin to the track. Open Scripter, and click the "Open Script in Editor" button. Delete the code, then paste in the code from the file `DrumEggiator.js`, then hit `Run Script`. Don't forget to hit `Run Script`! Otherwise the code will not run. Close the editor and choose "Save as" from the Scripter dropdown menu.

#### Description:

DrumEggiator randomly chooses one or more active MIDI note from the `Active Notes` (the number of which is controlled by the `Simultaneous notes` parameter), and then plays them at a randomized rhythm, which is controlled by two parameters: `Beat division` and `Number of notes`.

`Beat division` represents the number of possible notes in a beat. These notes will be equally spaced.

`Number of notes` represents the number of notes to be played during a given beat.

#### Usage:

On a keyboard or in the piano roll, hold down some notes. Ex: C3 E3 G3.

`Active Notes`: C3, E3, G3.

`Beat division`: 4

`Number of notes`: 2

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
