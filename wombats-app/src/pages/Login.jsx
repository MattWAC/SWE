import { useState } from "react";
import { useNavigate } from 'react-router-dom';





const Login = () => {
  const [login,setLogin] = useState("");
  const [password,setPass] = useState("");
  const [errorMSG,setError] = useState("");
  const nav = useNavigate();

  const check_login = (e) => {
    e.preventDefault();
    if(login == "Test" && password == "Test"){
      nav("/"); // TODO make this check the auth and get the cookie starting
    } else {
      setError("login or password is inncorrect.")
    }
  }

  return (
    <div className="page">
      <h1>Login</h1>
      {/* <p>Login form will be implemented here.</p> */}
      <form onSubmit={check_login}>
        <input 
          type="text"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
        />
        <br/>
        <input 
          type="password"
          value={password}
          onChange={(e) => setPass(e.target.value)}
        />
        <br/>
        <button type="submit">Login</button>
        {errorMSG ? (<p>{errorMSG}</p>) : ""}
      </form>
    </div>
  );
};

export default Login;