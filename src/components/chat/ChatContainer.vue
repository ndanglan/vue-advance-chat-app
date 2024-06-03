<template>
  <div class="window-container" :class="{ 'window-mobile': props.isDevice }">
    <form v-if="addNewRoom" @submit.prevent="createRoom">
      <input v-model="addRoomUsername" type="text" placeholder="Add username" />
      <button type="submit" :disabled="disableForm || !addRoomUsername">
        Create Room
      </button>
      <button class="button-cancel" @click="addNewRoom = false">Cancel</button>
    </form>

    <form v-if="inviteRoomId" @submit.prevent="addRoomUser">
      <input v-model="invitedUsername" type="text" placeholder="Add username" />
      <button type="submit" :disabled="disableForm || !invitedUsername">
        Add User
      </button>
      <button class="button-cancel" @click="inviteRoomId = null">Cancel</button>
    </form>

    <form v-if="removeRoomId" @submit.prevent="deleteRoomUser">
      <select v-model="removeUserId">
        <option default value="">Select User</option>
        <option v-for="user in removeUsers" :key="user._id" :value="user._id">
          {{ user.username }}
        </option>
      </select>
      <button type="submit" :disabled="disableForm || !removeUserId">
        Remove User
      </button>
      <button class="button-cancel" @click="removeRoomId = null">Cancel</button>
    </form>

    <vue-advanced-chat ref="chatWindow" :height="screenHeight" :theme="theme"
      :styles="JSON.stringify(styles)" :current-user-id="currentUserId" :room-id="roomId"
      :rooms="JSON.stringify(loadedRooms)" :loading-rooms="loadingRooms" :rooms-loaded="roomsLoaded"
      :messages="JSON.stringify(messages)" :messages-loaded="messagesLoaded"
      :room-message="roomMessage" :room-actions="JSON.stringify(roomActions)"
      :menu-actions="JSON.stringify(menuActions)"
      :message-selection-actions="JSON.stringify(messageSelectionActions)"
      :templates-text="JSON.stringify(templatesText)" @fetch-more-rooms="fetchMoreRooms"
      @fetch-messages="fetchMessages($event.detail[0])"
      @send-message="sendMessage($event.detail[0])" @edit-message="editMessage($event.detail[0])"
      @delete-message="deleteMessage($event.detail[0])" @open-file="openFile($event.detail[0])"
      @open-user-tag="openUserTag($event.detail[0])" @add-room="addRoom($event.detail[0])"
      @room-action-handler="menuActionHandler($event.detail[0])"
      @menu-action-handler="menuActionHandler($event.detail[0])" @message-selection-action-handler="
        messageSelectionActionHandler($event.detail[0])
        " @send-message-reaction="sendMessageReaction($event.detail[0])"
      @typing-message="typingMessage($event.detail[0])"
      @toggle-rooms-list="$emit('show-demo-options', $event.detail[0].opened)">
    </vue-advanced-chat>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue';
import * as firestoreService from 'src/services/firebase/firestore'
import * as firebaseService from 'src/services/firebase/firebase'
import * as storageService from 'src/services/firebase/storage'
import { parseTimestamp, formatTimestamp } from 'src/utils/date.ts'

import { register } from 'vue-advanced-chat'
register()
const props = defineProps(['currentUserId', 'theme', 'isDevice'])

const roomsPerPage = ref(15);
const rooms = ref([]);
const roomId = ref('');
const startRooms = ref(null);
const endRooms = ref(null);
const roomsLoaded = ref(false);
const loadingRooms = ref(true);
const allUsers = ref([]);
const loadingLastMessageByRoom = ref(0);
const roomsLoadedCount = ref(0);
const selectedRoom = ref(null);
const messagesPerPage = ref(20);
const messages = ref([]);
const messagesLoaded = ref(false);
const roomMessage = ref('');
const lastLoadedMessage = ref(null);
const previousLastLoadedMessage = ref(null);
const roomsListeners = ref([]);
const listeners = ref([]);
const typingMessageCache = ref('');
const disableForm = ref(false);
const addNewRoom = ref(null);
const addRoomUsername = ref('');
const inviteRoomId = ref(null);
const invitedUsername = ref('');
const removeRoomId = ref(null);
const removeUserId = ref('');
const removeUsers = ref([]);
const roomActions = ref([
  { name: 'inviteUser', title: 'Invite User' },
  { name: 'removeUser', title: 'Remove User' },
  { name: 'deleteRoom', title: 'Delete Room' }
]);
const menuActions = ref([
  { name: 'inviteUser', title: 'Invite User' },
  { name: 'removeUser', title: 'Remove User' },
  { name: 'deleteRoom', title: 'Delete Room' }
]);
const messageSelectionActions = ref([{ name: 'deleteMessages', title: 'Delete' }]);
const styles = ref({ container: { borderRadius: '4px' } });
const templatesText = ref([
  {
    tag: 'help',
    text: 'This is the help'
  },
  {
    tag: 'action',
    text: 'This is the action'
  },
  {
    tag: 'action 2',
    text: 'This is the second action'
  }
]);
const screenHeight = computed(() => {
  return props.isDevice.value ? window.innerHeight + 'px' : 'calc(100vh - 80px)'
});
const loadedRooms = computed(() => {
  return rooms.value.slice(0, roomsLoadedCount.value)
});

onMounted(() => {
  fetchRooms()
  firebaseService.updateUserOnlineStatus(props.currentUserId)
});

const resetRooms = () => {
  loadingRooms.value = true
  loadingLastMessageByRoom.value = 0
  roomsLoadedCount.value = 0
  rooms.value = []
  roomsLoaded.value = true
  startRooms.value = null
  endRooms.value = null
  roomsListeners.value.forEach(listener => listener())
  roomsListeners.value = []
  resetMessages()
}

const resetMessages = () => {
  messages.value = []
  messagesLoaded.value = false
  lastLoadedMessage.value = null
  previousLastLoadedMessage.value = null
  listeners.value.forEach(listener => listener())
  listeners.value = []
}

const fetchRooms = () => {
  resetRooms()
  fetchMoreRooms()
}

const fetchMoreRooms = async () => {
  if (endRooms.value && !startRooms.value) {
    roomsLoaded.value = true
    return
  }
  const query = firestoreService.roomsQuery(props.currentUserId, roomsPerPage.value, startRooms.value)
  const { data, docs } = await firestoreService.getRooms(query)
  roomsLoaded.value = data.length === 0 || data.length < roomsPerPage.value

  if (startRooms.value) endRooms.value = startRooms.value
  startRooms.value = docs[docs.length - 1]
  const roomUserIds = [];
  console.log('\x1b[31mContent\x1b[0m', data);
  data.forEach(room => {
    room.users.forEach(userId => {
      const foundUser = allUsers.value.find(user => user?._id === userId)
      if (!foundUser && roomUserIds.indexOf(userId) === -1) {
        roomUserIds.push(userId)
      }
    })
  })

  const rawUsers = [];
  roomUserIds.forEach(userId => {
    const promise = firestoreService.getUser(userId)
    rawUsers.push(promise)
  })
  allUsers.value = [...allUsers.value, ...(await Promise.all(rawUsers))]
  const roomList = {}
  data.forEach(room => {
    roomList[room.id] = { ...room, users: [] }
    room.users.forEach(userId => {
      const foundUser = allUsers.value.find(user => user?._id === userId)
      if (foundUser) roomList[room.id].users.push(foundUser)
    })
  })
  const formattedRooms = [];

  Object.keys(roomList).forEach(key => {
    const room = roomList[key]
    const roomContacts = room.users.filter(user => user._id !== props.currentUserId)
    room.roomName = roomContacts.map(user => user.username).join(', ') || 'Myself'
    const roomAvatar = roomContacts.length === 1 && roomContacts[0].avatar ? roomContacts[0].avatar : ''
    formattedRooms.push({
      ...room,
      roomId: key,
      avatar: roomAvatar,
      index: room.lastUpdated.seconds,
      lastMessage: {
        content: 'Room created',
        timestamp: formatTimestamp(new Date(room.lastUpdated.seconds), new Date(room.lastUpdated.seconds))
      }
    })
  })
  rooms.value = rooms.value.concat(formattedRooms)
  formattedRooms.forEach(room => listenLastMessage(room))
  if (!rooms.value.length) {
    loadingRooms.value = false
    roomsLoadedCount.value = 0
  }
  listenUsersOnlineStatus(formattedRooms)
  listenRooms(query)
}

const listenLastMessage = (room) => {
  const listener = firestoreService.listenLastMessage(room.roomId, messages => {
    messages.forEach(message => {
      const lastMessage = formatLastMessage(message, room)
      const roomIndex = rooms.value.findIndex(r => room.roomId === r.roomId)
      rooms.value[roomIndex].lastMessage = lastMessage
      rooms.value = [...rooms.value]
    })
    if (loadingLastMessageByRoom.value < rooms.value.length) {
      loadingLastMessageByRoom.value++
      if (loadingLastMessageByRoom.value === rooms.value.length) {
        loadingRooms.value = false
        roomsLoadedCount.value = rooms.value.length
      }
    }
  })

  roomsListeners.value.push(listener)
}

const formatLastMessage = (message, room) => {
  if (!message.timestamp) return
  let content = message.content
  if (message.files?.length) {
    const file = message.files[0]
    content = `${file.name}.${file.extension || file.type}`
  }
  const username = message.sender_id !== props.currentUserId ? room.users.find(user => message.sender_id === user._id)?.username : ''
  return {
    ...message,
    ...{
      _id: message.id,
      content,
      senderId: message.sender_id,
      timestamp: formatTimestamp(new Date(message.timestamp.seconds * 1000), new Date(message.timestamp.seconds * 1000)),
      username: username,
      distributed: true,
      seen: message.sender_id === props.currentUserId ? message.seen : null,
      new: message.sender_id !== props.currentUserId && (!message.seen || !message.seen[props.currentUserId])
    }
  }
}

const fetchMessages = ({ room, options = {} }) => {
  if (options.reset) resetMessages()
  if (previousLastLoadedMessage.value && !lastLoadedMessage.value) {
    messagesLoaded.value = true
    return
  }
  selectedRoom.value = room.roomId
  firestoreService.getMessages(room.roomId, messagesPerPage.value, lastLoadedMessage.value).then(({ data, docs }) => {
    if (selectedRoom.value !== room.roomId) return
    if (data.length === 0 || data.length < messagesPerPage.value) {
      setTimeout(() => {
        messagesLoaded.value = true
      }, 0)
    }
    if (options.reset) messages.value = []
    data.forEach(message => {
      const formattedMessage = formatMessage(room, message)
      messages.value.unshift(formattedMessage)
    })
    if (lastLoadedMessage.value) previousLastLoadedMessage.value = lastLoadedMessage
    lastLoadedMessage.value = docs[docs.length - 1]
    listenMessages(room)
  })
}

const listenMessages = room => {
  const listener = firestoreService.listenMessages(room.roomId, lastLoadedMessage.value, previousLastLoadedMessage.value, firebaseMessages => {
    firebaseMessages.forEach(message => {
      const formattedMessage = formatMessage(room, message)
      const messageIndex = messages.value.findIndex(m => m._id === message.id)
      if (messageIndex === -1) {
        messages.value = messages.value.concat([formattedMessage])
      } else {
        messages.value[messageIndex] = formattedMessage
        messages.value = [...messages.value]
      }
      markMessagesSeen(room, message)
    })
  })

  listeners.value.push(listener)
}

const markMessagesSeen = (room, message) => {
  if (message.sender_id !== props.currentUserId && (!message.seen || !message.seen[props.currentUserId])) {
    firestoreService.updateMessage(room.roomId, message.id, {
      [`seen.${props.currentUserId}`]: new Date()
    })
  }
}

const formatMessage = (room, message) => {
  const formattedMessage = {
    ...message,
    ...{
      senderId: message.sender_id,
      _id: message.id,
      seconds: message.timestamp.seconds,
      timestamp: parseTimestamp(new Date(message.timestamp.seconds * 1000), 'HH:mm'),
      date: parseTimestamp(new Date(message.timestamp.seconds * 1000), 'DD MMMM YYYY'),
      username: room.users.find(user => message.sender_id === user._id)?.username,
      distributed: true
    }
  }
  if (message.replyMessage) {
    formattedMessage.replyMessage = {
      ...message.replyMessage,
      ...{
        senderId: message.replyMessage.sender_id
      }
    }
  }
  return formattedMessage
}

const sendMessage = async ({ content, roomId, files, replyMessage }) => {
  const message = {
    sender_id: props.currentUserId,
    content,
    timestamp: new Date()
  }
  if (files) {
    message.files = formattedFiles(files)
  }
  if (replyMessage) {
    message.replyMessage = {
      _id: replyMessage._id,
      content: replyMessage.content,
      sender_id: replyMessage.senderId
    }
    if (replyMessage.files) {
      message.replyMessage.files = replyMessage.files
    }
  }
  const { id } = await firestoreService.addMessage(roomId, message)
  if (files) {
    for (let index = 0; index < files.length; index++) {
      await uploadFile({ file: files[index], messageId: id, roomId })
    }
  }
  firestoreService.updateRoom(roomId, { lastUpdated: new Date() })
}

const editMessage = async ({ messageId, newContent, roomId, files }) => {
  const newMessage = { edited: new Date() }
  newMessage.content = newContent
  if (files) {
    newMessage.files = formattedFiles(files)
  } else {
    newMessage.files = firestoreService.deleteDbField
  }
  await firestoreService.updateMessage(roomId, messageId, newMessage)
  if (files) {
    for (let index = 0; index < files.length; index++) {
      if (files[index]?.blob) {
        await uploadFile({ file: files[index], messageId, roomId })
      }
    }
  }
}

const deleteMessage = async ({ message, roomId }) => {
  await firestoreService.updateMessage(roomId, message._id, { deleted: new Date() })
  const { files } = message
  if (files) {
    files.forEach(file => {
      storageService.deleteFile(props.currentUserId, message._id, file)
    })
  }
}

const uploadFile = async ({ file, messageId, roomId }) => {
  return new Promise(resolve => {
    let type = file.extension || file.type
    if (type === 'svg' || type === 'pdf') {
      type = file.type
    }
    storageService.listenUploadImageProgress(props.currentUserId, messageId, file, type, progress => {
      updateFileProgress(messageId, file.localUrl, progress)
    }, _error => {
      console.log('\x1b[31mContent\x1b[0m', _error);
      resolve(false)
    }, async url => {
      const message = await firestoreService.getMessage(roomId, messageId)
      message.files.forEach(f => {
        if (f.url === file.localUrl) {
          f.url = url
        }
      })
      await firestoreService.updateMessage(roomId, messageId, { files: message.files })
      resolve(true)
    })
  })
}

const updateFileProgress = (messageId, fileUrl, progress) => {
  const message = messages.value.find(message => message._id === messageId)
  if (!message || !message.files) return
  message.files.find(file => file.url === fileUrl).progress = progress
  messages.value = [...messages.value]
}

const formattedFiles = files => {
  const formattedFiles = []
  files.forEach(file => {
    const messageFile = {
      name: file.name,
      size: file.size,
      type: file.type,
      extension: file.extension || file.type,
      url: file.url || file.localUrl
    }
    if (file.audio) {
      messageFile.audio = true
      messageFile.duration = file.duration
    }
    formattedFiles.push(messageFile)
  })
  return formattedFiles
}

const openFile = ({ file }) => {
  window.open(file.file.url, '_blank')
}

const openUserTag = async ({ user }) => {
  let localRoomId;
  rooms.value.forEach(room => {
    if (room.users.length === 2) {
      const userId1 = room.users[0]._id
      const userId2 = room.users[1]._id
      if ((userId1 === user._id || userId1 === props.currentUserId) && (userId2 === user._id || userId2 === props.currentUserId)) {
        roomId.value = room.roomId
      }
    }
  })
  if (localRoomId) {
    roomId.value = localRoomId
    return
  }
  const query1 = await firestoreService.getUserRooms(props.currentUserId, user._id)
  if (query1.data.length) {
    return loadRoom(query1)
  }
  const query2 = await firestoreService.getUserRooms(user._id, props.currentUserId)
  if (query2.data.length) {
    return loadRoom(query2)
  }
  const users = user._id === props.currentUserId ? [props.currentUserId] : [user._id, props.currentUserId]
  const room = await firestoreService.addRoom({ users, lastUpdated: new Date() })
  roomId.value = room.id
  fetchRooms()
}

const loadRoom = async query => {
  query.forEach(async room => {
    if (loadingRooms.value) return
    await firestoreService.updateRoom(room.id, { lastUpdated: new Date() })
    roomId.value = room.id
    fetchRooms()
  })
}

const menuActionHandler = ({ action, roomId }) => {
  switch (action.name) {
    case 'inviteUser':
      return inviteUser(roomId)
    case 'removeUser':
      return removeUser(roomId)
    case 'deleteRoom':
      return deleteRoom(roomId)
  }
}

const messageSelectionActionHandler = ({ action, messages, roomId }) => {
  switch (action.name) {
    case 'deleteMessages':
      messages.forEach(message => {
        deleteMessage({ message, roomId })
      })
  }
}

const sendMessageReaction = async ({ reaction, remove, messageId, roomId }) => {
  firestoreService.updateMessageReactions(
    roomId,
    messageId,
    props.currentUserId,
    reaction.unicode,
    remove ? 'remove' : 'add'
  )
}

const typingMessage = ({ message, roomId }) => {
  if (roomId) {
    if (message?.length > 1) {
      typingMessageCache.value = message
      return
    }
    if (message?.length === 1 && typingMessageCache) {
      typingMessageCache.value = message
      return
    }
    typingMessageCache.value = message
    firestoreService.updateRoomTypingUsers(roomId, props.currentUserId, message ? 'add' : 'remove')
  }
}

const listenRooms = async query => {
  const listener = firestoreService.listenRooms(query, rooms => {
    rooms.forEach(room => {
      const foundRoom = rooms.find(r => r.roomId === room.id)
      if (foundRoom) {
        foundRoom.typingUsers = room.typingUsers
        foundRoom.index = room.lastUpdated.seconds
      }
    })
  })
  roomsListeners.value.push(listener)
}

const listenUsersOnlineStatus = rooms => {
  rooms.forEach(room => {
    room.users.forEach(user => {
      const listener = firebaseService.firebaseListener(
        firebaseService.userStatusRef(user._id),
        snapshot => {
          if (!snapshot || !snapshot.val()) return

          const lastChanged = formatTimestamp(
            new Date(snapshot.val().lastChanged),
            new Date(snapshot.val().lastChanged)
          )

          user.status = { ...snapshot.val(), lastChanged }

          const roomIndex = rooms.value.findIndex(
            r => room.roomId === r.roomId
          )

          rooms.value[roomIndex] = room
          rooms.value = [...rooms.value]
        }
      )
      roomsListeners.value.push(listener)
    })
  })
}

const addRoom = () => {
  resetForms()
  addNewRoom.value = true
}

const remoteUsers = ref([
  {
    _id: '6R0MijpK6M4AIrwaaCY2',
    username: 'Luke',
    avatar: 'https://66.media.tumblr.com/avatar_c6a8eae4303e_512.png'
  },
  {
    _id: 'SGmFnBZB4xxMv9V4CVlW',
    username: 'Leia',
    avatar: 'https://media.glamour.com/photos/5695e9d716d0dc3747eea3ef/master/w_1600,c_limit/beauty-2015-12-princess-leia-1-main.jpg'
  },
  {
    _id: '6jMsIXUrBHBj7o2cRlau',
    username: 'Yoda',
    avatar:
      'https://vignette.wikia.nocookie.net/teamavatarone/images/4/45/Yoda.jpg/revision/latest?cb=20130224160049'
  }
])

const createRoom = async () => {
  disableForm.value = true
  const selectedUser = remoteUsers.value.find((item) => item.username === addRoomUsername.value)

  if (!selectedUser) {
    return alert('User not found')
  }
  await firestoreService.addRoom({
    users: [selectedUser._id, props.currentUserId],
    lastUpdated: new Date()
  })
  addNewRoom.value = false
  addRoomUsername.value = ''
  fetchRooms()
}

const inviteUser = roomId => {
  resetForms()
  inviteRoomId.value = roomId
}

const addRoomUser = async () => {
  disableForm.value = true

  const selectedUser = remoteUsers.value.find((item) => item.username === invitedUsername.value)
  if (!selectedUser) {
    return alert('User not found')
  }
  await firestoreService.addRoomUser(inviteRoomId.value, selectedUser._id)
  inviteRoomId.value = null
  invitedUsername.value = ''
  fetchRooms()
}

const removeUser = roomId => {
  resetForms()
  removeRoomId.value = roomId
  removeUsers.value = rooms.value.find(room => room.roomId === roomId).users
}

const deleteRoomUser = async () => {
  disableForm.value = true
  await firestoreService.removeRoomUser(removeRoomId, removeUserId)
  removeRoomId.value = null
  removeUserId.value = ''
  fetchRooms()
}

const deleteRoom = async roomId => {
  const room = rooms.value.find(r => r.roomId === roomId)
  if (
    room.users.find(user => user._id === 'SGmFnBZB4xxMv9V4CVlW') ||
    room.users.find(user => user._id === '6jMsIXUrBHBj7o2cRlau')
  ) {
    return alert('Nope, for demo purposes you cannot delete this room')
  }

  firestoreService.getMessages(roomId).then(({ data }) => {
    data.forEach(message => {
      firestoreService.deleteMessage(roomId, message.id)
      if (message.files) {
        message.files.forEach(file => {
          storageService.deleteFile(props.currentUserId, message.id, file)
        })
      }
    })
  })

  await firestoreService.deleteRoom(roomId)

  fetchRooms()
}

const resetForms = () => {
  disableForm.value = false
  addNewRoom.value = null
  addRoomUsername.value = ''
  inviteRoomId.value = null
  invitedUsername.value = ''
  removeRoomId.value = null
  removeUserId.value = ''
}

</script>

<style lang="scss" scoped>
.window-container {
  width: 100%;
}

.window-mobile {
  form {
    padding: 0 10px 10px;
  }
}

form {
  padding-bottom: 20px;
}

input {
  padding: 5px;
  width: 140px;
  height: 21px;
  border-radius: 4px;
  border: 1px solid #d2d6da;
  outline: none;
  font-size: 14px;
  vertical-align: middle;

  &::placeholder {
    color: #9ca6af;
  }
}

button {
  background: #1976d2;
  color: #fff;
  outline: none;
  cursor: pointer;
  border-radius: 4px;
  padding: 8px 12px;
  margin-left: 10px;
  border: none;
  font-size: 14px;
  transition: 0.3s;
  vertical-align: middle;

  &:hover {
    opacity: 0.8;
  }

  &:active {
    opacity: 0.6;
  }

  &:disabled {
    cursor: initial;
    background: #c6c9cc;
    opacity: 0.6;
  }
}

.button-cancel {
  color: #a8aeb3;
  background: none;
  margin-left: 5px;
}

select {
  vertical-align: middle;
  height: 33px;
  width: 152px;
  font-size: 13px;
  margin: 0 !important;
}
</style>