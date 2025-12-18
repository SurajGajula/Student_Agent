import { create } from 'zustand'

export interface Class {
  id: string
  name: string
  folderId?: string
  time?: {
    days: string[]
    timeRange: string
  }
}

export interface Folder {
  id: string
  name: string
}

interface ClassesStore {
  classes: Class[]
  folders: Folder[]
  addClass: (name: string, folderId?: string, time?: { days: string[], timeRange: string }) => void
  removeClass: (id: string) => void
  addFolder: (name: string) => void
  removeFolder: (id: string) => void
}

export const useClassesStore = create<ClassesStore>((set) => ({
  classes: [],
  folders: [],
  addClass: (name: string, folderId?: string, time?: { days: string[], timeRange: string }) => {
    const newClass: Class = {
      id: Date.now().toString(),
      name: name.trim(),
      folderId: folderId,
      time: time
    }
    set((state) => ({
      classes: [...state.classes, newClass]
    }))
  },
  removeClass: (id: string) => {
    set((state) => ({
      classes: state.classes.filter((classItem) => classItem.id !== id)
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

