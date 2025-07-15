const allContent = [];

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
  ];

  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          if (value === null) return '';
          if (typeof value === 'string') {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(','),
    ),
  ].join('\n');

  const csvContentWithBom = '\uFEFF' + csvContent;
  const blob = new Blob([csvContentWithBom], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  if (navigator.msSaveBlob) {
    navigator.msSaveBlob(blob, fileName);
  } else {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName || 'data.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

async function scrollDown() {
  const wrapper = window;
  await new Promise((resolve) => {
    var distance = 800;
    var timer = setInterval(async () => {
      wrapper.scrollBy(0, distance);
      clearInterval(timer);
      resolve();
    }, 400);
  });
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

function getEmailFromText(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const email = text?.match(emailRegex)?.[0];
  return email || '';
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// This is the only parsing function you need now.
function parsePostJson(json) {
  // Check both possible locations for the story data.
  let storyNode = json?.data?.node?.group_feed?.edges?.[0]?.node;

  // This handles the slightly different structure for subsequent posts in the same response
  if(!storyNode) {
    storyNode = json?.data?.node;
  }

  if (!storyNode || storyNode.__typename !== 'Story') {
    return null; // Not a story, skip it.
  }

  const actor = storyNode?.actors?.[0];
//   const postText = storyNode?.attachments[0]?.styles?.attachment?.media?.accessibility_caption;
  const postText = storyNode?.comet_sections?.content?.story?.message?.text;
  console.log('storyNode', storyNode)
  const postId = storyNode?.post_id;

  if (!postId) {
    return null;
  }

  const post = {
    id: postId,
    postId,
    postText: postText || '',
    postAuthor: actor?.name,
    postAuthorId: actor?.id,
    postAuthorUrl: actor?.url,
    email: getEmailFromText(postText || ''),
    firstName: actor?.name?.split(' ')?.[0],
    lastName: actor?.name?.split(' ')?.[1],
  };

  return { post };
}

function interceptRequests() {
  let oldXHROpen = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function (method, url, async) {
    if (!url.includes('graphql')) {
      return oldXHROpen.apply(this, arguments);
    }

    let requestBody = null;
    let oldXHRSend = this.send;
    this.send = function (data) {
      requestBody = data;
      oldXHRSend.apply(this, arguments);
    };

    this.addEventListener('load', function () {
      if (
        requestBody?.includes('GroupsCometFeedRegularStoriesPaginationQuery')
      ) {
        const lines = this.responseText.split('\n');

        lines.forEach(line => {
          if (!line.trim()) {
            return; // Skip empty lines
          }
          try {
            const data = JSON.parse(line);
            const parsedData = parsePostJson(data);

            if (parsedData && parsedData.post) {
                // Avoid duplicates
                if (!allContent.find(p => p.id === parsedData.post.id)) {
                    allContent.push(parsedData.post);
                }
            }
          } catch (e) {
            // console.log("Could not parse a line, skipping.");
          }
        });
      }
    });

    return oldXHROpen.apply(this, arguments);
  };
}


async function run() {
  interceptRequests();
  console.log('starting...');

  let scrollsLeft = 8; // Your desired number of scrolls

  while (scrollsLeft > 0) {
    console.log(`Scrolling... ${scrollsLeft} scrolls left.`);
    await scrollDown();
    scrollsLeft--;
    // We wait a bit for the network requests to be caught and processed by the interceptor.
    await sleep(2000);
  }

  // A final short wait to make sure the last batch of data is processed.
  await sleep(3000);

  createCSV(allContent, 'facebookGroupPostsAndComments.csv');
  console.log('allContent', allContent);
  console.log('done!');
  console.log(
    `Congrats! 🎉 You scraped a sh*t ton of posts! If you need any custom scrapers built, email me: adrian@thewebscrapingguy.com`,
  );
}

let scrolls = 8;
await run();