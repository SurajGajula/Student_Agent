import { create } from 'zustand'

export interface Note {
  id: string
  name: string
  folderId?: string
  content?: string
}

export interface Folder {
  id: string
  name: string
}

interface NotesStore {
  notes: Note[]
  folders: Folder[]
  addNote: (name: string, folderId?: string) => void
  removeNote: (id: string) => void
  addFolder: (name: string) => void
  removeFolder: (id: string) => void
  updateNoteContent: (id: string, content: string) => void
}

export const useNotesStore = create<NotesStore>((set) => ({
  notes: [],
  folders: [],
  addNote: (name: string, folderId?: string) => {
    const newNote: Note = {
      id: Date.now().toString(),
      name: name.trim(),
      folderId: folderId,
      content: ''
    }
    set((state) => ({
      notes: [...state.notes, newNote]
    }))
  },
  updateNoteContent: (id: string, content: string) => {
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === id ? { ...note, content } : note
      )
    }))
  },
  removeNote: (id: string) => {
    set((state) => ({
      notes: state.notes.filter((note) => note.id !== id)
    }))
  },
  addFolder: (name: string) => {
    const newFolder: Folder = {
      id: Date.now().toString(),
      name: name.trim()
    }
    set((state) => ({
      folders: [...state.folders, newFolder]
    }))
  },
  removeFolder: (id: string) => {
    set((state) => ({
      folders: state.folders.filter((folder) => folder.id !== id)
    }))
  }
}))

