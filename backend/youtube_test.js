const key = 'AIzaSyAZbsuWtvGJ1rcJwzZk971_yYsbgKBbu8o';
const query = encodeURIComponent('mẹ bầu');
const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=3&videoDuration=short&q=${query}&key=${key}`;

fetch(url)
  .then(async (res) => {
    console.log('status', res.status);
    console.log(await res.text());
  })
  .catch((err) => {
    console.error('fetch error', err);
  });
