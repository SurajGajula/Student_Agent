import express from 'express'
import addNoteRouter from './addNote.js'
import updateNoteRouter from './updateNote.js'
import deleteNoteRouter from './deleteNote.js'
import listNotesRouter from './listNotes.js'
import moveNoteRouter from './moveNote.js'

const router = express.Router()

router.use(addNoteRouter)
router.use(updateNoteRouter)
router.use(deleteNoteRouter)
router.use(listNotesRouter)
router.use(moveNoteRouter)

export default router

