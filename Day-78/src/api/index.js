export const getPosts = async () => {
  const response = await fetch("https://jsonplaceholder.typicode.com/posts", {
    method: "GET",
  });
  return response.json();
};


