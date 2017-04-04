require('stream')

const PouchDB = require('pouchdb')
const replicationStream = require('pouchdb-replication-stream')
const pouchload = require('pouchdb-load')

// PouchDB.plugin(replicationStream.plugin)
// PouchDB.adapter('writableStream', replicationStream.adapters.writableStream)
PouchDB.plugin({
  loadIt: pouchload.load
})


const choo = require('choo')
const html = require('choo/html')
const blobStream = require('blob-stream')
const blobUtil = require('blob-util')

const app = choo()

app.use(store)
app.route('/', mainView)
app.mount('body')

function mainView (state, emit) {
  return html`
    <body>
      <button onclick=${e => emit('export-project')}>Export project</button>
      <button onclick=${e => emit('create-mix')}>New Mix</button>
      <label for="import-project">import project</label>
      <input onchange=${importProject} id="import-project" type="file" style="display: none;" aria-hidden="true">
      <label for="import-track">import track</label>
      <input onchange=${importTrack} id="import-track" type="file" style="display: none;" aria-hidden="true">
      <ul>
        ${state.tracks.map(track => html`<li>${track.title}</li>`)}
      </ul>
    </body>
  `

  function importProject (e) {
    const file = e.target.files[0]
    emit('import-project', file)
  }

  function importTrack (e) {
    const file = e.target.files[0]
    emit('import-track', file)
  }
}

function store (state, emitter) {
  state.tracks = []

  emitter.on('DOMContentLoaded', () => {
    const db = new PouchDB('test-db')

    emitter.on('import-project', file => {

      const url = URL.createObjectURL(file)

      db.loadIt(url).then(function () {
        // done loading!
        console.log('done!')
        URL.revokeObjectURL(url)
        emitter.emit('imported-project')
      }).catch(function (err) {
        // any possible errors
        console.log(err)
      });

    })

    emitter.on('export-project', track => {
      const stream = blobStream()

      stream.on('finish', function () {
        let url = this.toBlobURL()
        let a = html`<a download="myproject.mix" href=${url}></a>`
        a.click()
      })

      db.dump(stream).then(res => {
        console.log(res)
      })
    })

    emitter.on('import-track', file => {
      db.post({
        title: file.name,
        _attachments: {
          'audiofile': {
            content_type: file.type,
            data: file
          }
        }
      }).then(res => {
        db.get(res.id).then(track => {
          console.log(track)
          state.tracks.push(track)
          emitter.emit('render')
        })

      })
    })

    emitter.on('load-file', track => {
      state.tracks.push(track)
      emitter.emit('render')
    })

    emitter.on('imported-project', () => {
      console.log('imported it')
      db.allDocs({include_docs: true, attachments: true}).then(res => {
        const docs = res.rows.map(row => row.doc)
        console.log(docs)

        docs.forEach(doc => {
          db.getAttachment(doc._id, 'audiofile').then(blob => {
            emitter.emit('load-file', {
              title: doc.title,
              file: blob
            })
          })
        })
      })
    })


  })
}