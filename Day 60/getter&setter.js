class user {
    constructor (email,password){
        this.email = email;
        this.password = password;
    }

    get password(){
        // return this._password.toUpperCase()
        return `${this._password}Ankit`
    }

    set password(value){
        this._password = value
    } 

    get email (){
        return `${this._email}Ankit`
    }
    set email (value){
        this._email = value
    }
}
const Ankit = new user ("ankit@gmail.com","2365abc")
console.log(Ankit.password);
console.log(Ankit.email);