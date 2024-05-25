import { useEffect, useState } from "react";
import "./App.css";
import { getPosts } from "./api";
import Card from "./component/Card";
 
 

function App() {
  const [data, setdata] = useState(null);

  useEffect(() => {
    getPosts().then((posts) => setdata(posts));
  }, []);

  return (
    <>
      <div>
        {data ? (
          data.map((e) => (
            <Card title={e.title} body={e.body}>
              {" "}
            </Card>
          ))
        ) : (
          <p>No Data</p>
        )}
      </div>
    </>
  );
}

export default App;
