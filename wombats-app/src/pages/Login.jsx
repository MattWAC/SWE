import { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut} from "firebase/auth";
import { updateDoc, doc, setDoc } from "firebase/firestore";
import { auth, db } from "../contexts/firebase";



const Login = () => {
  const [email,setemail] = useState("");
  const [password,setPass] = useState("");
  const [password2,setPass2] = useState("");
  const [errorMSG,setError] = useState("");
  const [createAccount,SetCreateAccount] = useState(false);
  const [reset, SetReset] = useState(false);
  const nav = useNavigate();

  // const unsubcribe = onAuthStateChanged(auth, (user) => {
  //   setAuth(true)
  // });
  // unsubcribe()

  

  const logout = (e) => {
    signOut(auth);
    setError("Logged Out");
  } // probly move this to top bar

  const login = (e) => {
    e.preventDefault();
    // console.log(email,password)
    signInWithEmailAndPassword(auth,email,password).then((result) => {
      // Signed in 
      result.uid
      nav("/");
      // ...
    })
    .catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
      setError(errorMessage);
      // console.log(errorMessage);
    });
  }

  const create = (e) => {
    e.preventDefault();
    if(password != password2){
      setError("Passwords not match.");
      return;
    }

    createUserWithEmailAndPassword(auth, email, password).then((UserCred) => {
      setDoc(doc(db,`users/${auth.currentUser.uid}`),{"Money": 10000});
      nav("/");
    }).catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
      setError(errorMessage);
      // console.log(errorMessage);
    });
  }

  const reset_pass = (e) => {
    sendPasswordResetEmail(auth,email); //TODO make forgot pass
    SetReset(false);
  }

  return (
    <div className="page">
      <h1>Login</h1>
      {!createAccount && !reset ?
      (<form onSubmit={login}>
        <p>email:</p><input 
          type="email"
          value={email}
          onChange={(e) => setemail(e.target.value)}
          required
        />
        <br/>
        <p>Password:</p><input 
          type="password"
          value={password}
          onChange={(e) => setPass(e.target.value)}
          required
        />
        <br/>
        <a onClick={(e)=>(SetReset(true))}>Forgot password?</a>
        <br/>
        <button type="submit">Login</button>
        <button onClick={(e) => {SetCreateAccount(true)}}>Create Account</button>
        {errorMSG ? (<p>{errorMSG}</p>) : ""}
      </form>
      ) : ""}
      {createAccount ?
      (<form onSubmit={create}>
        <p>Email:</p><input 
          type="text"
          value={email}
          onChange={(e) => setemail(e.target.value)}
          required
        />
        <br/>
        <p>Password:</p><input 
          type="password"
          value={password}
          onChange={(e) => setPass(e.target.value)}
          required
        />
        <p>Retype Password:</p><input
          type="password"
          value={password2}
          onChange={(e) => setPass2(e.target.value)}
          required
        />
        <br/>
        <button type="submit">Create</button>
        {errorMSG ? (<p>{errorMSG}</p>) : ""}
      </form>
      ) : ""}
      {reset ? (
        <form onSubmit={reset_pass}>
        <p>Email:</p><input 
          type="text"
          value={email}
          onChange={(e) => setemail(e.target.value)}
          required
        />
        <br/>
        <button type="submit">Send</button>
        </form>
      ) : ""}
      {auth.currentUser ? (<button onClick={logout}>logout</button>): ""}
      
    </div>
  );
};

export default Login;