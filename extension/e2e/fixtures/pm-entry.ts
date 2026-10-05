import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema } from 'prosemirror-schema-basic';

const mount = document.getElementById('editor')!;
new EditorView(mount, { state: EditorState.create({ schema }) });
