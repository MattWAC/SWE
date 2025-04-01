import { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut} from "firebase/auth";
import { updateDoc, doc } from "firebase/firestore";
import { auth } from "../contexts/firebase";



const Login = () => {
  const [email,setemail] = useState("");
  const [password,setPass] = useState("");
  const [errorMSG,setError] = useState("");
  const [auth,setAuth] = useState(false);
  const nav = useNavigate();

  // const unsubcribe = onAuthStateChanged(auth, (user) => {
  //   setAuth(true)
  // });
  // unsubcribe()

  

  const logout = (e) => {
    signOut(auth);
  }

  const login = (e) => {
    e.preventDefault();
    console.log(email,password)
    signInWithEmailAndPassword(auth,email,password).then((result) => {
      // Signed in 
      updateDoc(doc(db,`users/${auth.currentUser.uid}`),{"Money": 10000}); // TODO move this to create account
      nav("/");
      // ...
    })
    .catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
      setError(errorMSG);
    });
  }

  const reset_pass = () => {
    // sendPasswordResetEmail(auth,email); //TODO make forgot pass
  }

  return (
    <div className="page">
      <h1>Login</h1>
      {/* <p>Login form will be implemented here.</p> */}
      <form onSubmit={login}>
        <input 
          type="text"
          value={email}
          onChange={(e) => setemail(e.target.value)}
          required
        />
        <br/>
        <input 
          type="password"
          value={password}
          onChange={(e) => setPass(e.target.value)}
          required
        />
        <a onClick={reset_pass}>Forgot password?</a>
        <br/>
        <button type="submit">Login</button>
        {errorMSG ? (<p>{errorMSG}</p>) : ""}
        {auth.currentUser ? (<button onClick={logout}>logout</button>): ""}
      </form>
    </div>
  );
};

export default Login;