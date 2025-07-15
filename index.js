const allContent = []

function createCSV(data, fileName) {
  const headers = [
    'id',
    'email',
    'firstName',
    'lastName',
    'postId',
    'postText',
    'postAuthor',
    'postAuthorId',
    'postAuthorUrl',
  ]

  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header]
          if (value === null) return 'null'
          if (typeof value === 'string') {
            // Wrap all fields, including those without commas, in double quotes
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        })
        .join(','),
    ),
  ].join('\n')

  const csvContentWithBom = '\uFEFF' + csvContent;
  const blob = new Blob([csvContentWithBom], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')

  if (navigator.msSaveBlob) {
    // IE 10+
    navigator.msSaveBlob(blob, fileName)
  } else {
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', fileName || 'data.csv')
    document.body.appendChild(link)

    link.click()

    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

async function scrollDown() {
  // const wrapper = document.querySelector("#search-page-list-container");
  const wrapper = window
  await new Promise((resolve, reject) => {
    var totalHeight = 0
    var distance = 800

    var timer = setInterval(async () => {
      var scrollHeightBefore = wrapper.scrollHeight
      wrapper.scrollBy(0, distance)
      totalHeight += distance

      clearInterval(timer)
      resolve()
    }, 400)
  })
  await new Promise((resolve) => setTimeout(resolve, 1000))
}

function getEmailFromText(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const email = text?.match(emailRegex)?.[0]
  return email || ''
}

// Function to recursively traverse HTML elements and return text in an array
function traverseElementsToGetText(element) {
  var textArray = []

  // Check if the element has child nodes
  if (element.childNodes.length > 0) {
    // Loop through each child node
    for (var i = 0; i < element.childNodes.length; i++) {
      // Recursively call the function for each child node
      textArray = textArray.concat(
        traverseElementsToGetText(element.childNodes[i]),
      )
    }
  } else {
    // If the element is a text node and contains non-whitespace text
    if (
      element.nodeType === Node.TEXT_NODE &&
      element.nodeValue.trim() !== ''
    ) {
      // Push the text into the text array
      textArray.push(element.nodeValue.trim())
    }
  }

  return textArray
}

function getAllPosts() {
  const posts = document.querySelectorAll('div[role=feed] > div')
  return [...posts].filter((post) => {
    const posterName = post?.querySelector("h2")?.textContent || post?.querySelector("h3")?.textContent;
    if (posterName) {
      return true
    }
    return false
  })
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function parseFirstLevelJson(json) {
  const actor =
    json?.data?.node?.group_feed?.edges?.[0]?.node?.comet_sections?.content
      ?.story?.comet_sections?.context_layout?.story?.comet_sections
      ?.actor_photo?.story?.actors?.[0]

  const postText =
    json?.data?.node?.group_feed?.edges?.[0]?.node?.comet_sections?.content
      ?.story?.comet_sections?.message_container?.story?.message?.text
  const postId =
    json?.data?.node?.group_feed?.edges?.[0]?.node?.comet_sections?.feedback
      ?.story?.post_id

  const post = {
    id: postId,
    postId,
    postText: postText || '',
    postAuthor: actor?.name,
    postAuthorId: actor?.id,
    postAuthorUrl: actor?.url,
    email: getEmailFromText(postText),
    firstName: actor?.name?.split(' ')?.[0],
    lastName: actor?.name?.split(' ')?.[1],
  }

  return {
    post
  }
}

function parseSecondLevelJson(json) {
  const data2 = json
  const actor =
    data2?.data?.node?.comet_sections?.content?.story?.comet_sections
      ?.context_layout?.story?.comet_sections?.actor_photo?.story?.actors?.[0]

  const posterName = actor?.name
  const postText =
    data2?.data?.node?.comet_sections?.content?.story?.comet_sections
      ?.message_container?.story?.message?.text
  const id = actor?.id
  const postId = data2?.data?.node?.comet_sections?.feedback?.story?.post_id
  const url = actor?.url

  const post = {
    id: postId,
    postId,
    postText: postText || '',
    postAuthor: posterName,
    postAuthorId: id,
    postAuthorUrl: url,
    email: getEmailFromText(postText),
    firstName: posterName?.split(' ')?.[0],
    lastName: posterName?.split(' ')?.[1],
  }

  return {
    post
  }
}

function parseThirdLevelJson(json) {
  const data3 = json
  const actor3 =
    data3?.data?.node?.comet_sections?.content?.story?.comet_sections
      ?.context_layout?.story?.comet_sections?.actor_photo?.story?.actors?.[0]
  const posterName = actor3?.name
  const postText =
    data3?.data?.node?.comet_sections?.content?.story?.comet_sections
      ?.message_container?.story?.message?.text
  const posterId = actor3?.id
  const postId = data3?.data?.node?.comet_sections?.feedback?.story?.post_id
  const url = actor3?.url
  const post = {
    id: postId,
    postId,
    postText: postText || '',
    postAuthor: posterName,
    postAuthorId: posterId,
    postAuthorUrl: url,
    email: getEmailFromText(postText),
    firstName: posterName?.split(' ')?.[0],
    lastName: posterName?.split(' ')?.[1],
  }

  return {
    post
  }
}

function interceptRequests() {
  let oldXHROpen = window.XMLHttpRequest.prototype.open
  window.XMLHttpRequest.prototype.open = function (method, url, async) {
    if (!url.includes('graphql')) {
      return oldXHROpen.apply(this, arguments)
    }

    let requestBody = null
    let oldXHRSend = this.send
    this.send = function (data) {
      requestBody = data
      oldXHRSend.apply(this, arguments)
    }

    this.addEventListener('load', function () {
      if (
        requestBody?.includes('GroupsCometFeedRegularStoriesPaginationQuery')
      ) {
        const lines = this.response.split('\n')
        const data1 = JSON.parse(lines[0])
        const firstPost = parseFirstLevelJson(data1)
        allContent.push(firstPost.post)

        const data2 = JSON.parse(lines[1])
        const secondPost = parseSecondLevelJson(data2)
        allContent.push(secondPost.post)

        const data3 = JSON.parse(lines[2])
        const thirdPost = parseThirdLevelJson(data3)
        allContent.push(thirdPost.post)
      }
    })

    return oldXHROpen.apply(this, arguments)
  }
}


async function run() {
  interceptRequests()
  console.log('starting...')
  let posts = getAllPosts()
  console.log('posts.length', posts.length)
  // let i = 0

  while (scrolls > 0) {
    // const post = posts[i]
      await sleep(1000)
      console.log('allContent', allContent)
      await scrollDown()
      scrolls--
      console.log('scrolls left', scrolls)
      console.log('old posts', posts.length)
      const currentPosts = getAllPosts()
      console.log('currentPosts', currentPosts.length)
      posts = currentPosts
  }

  createCSV(allContent, 'facebookGroupPostsAndComments.csv')
  console.log('allContent', allContent)
  console.log('done!')
  console.log(
    `Congrats! 🎉 You scraped a sh*t ton of posts! If you need any custom scrapers built, email me: adrian@thewebscrapingguy.com`,
  )
}

let scrolls = 8
// NOTE: Only gets the first level comments
await run()