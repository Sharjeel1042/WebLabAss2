const mongoose=require('mongoose');

const userSchema=new mongoose.Schema({
    name:{
        type:String,
        required:[true,"User's name is required"],
        trim:true,
        maxlength:100
    },
    email:{
        type:String,
        required:[true,"Email is required"],
        unique:true,
        lowercase:true,
        trim:true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },
    role:{
        type:String,
        enum:{
            values:["student","staff"],
            message:'{VALUE} is not a valid role. Use either student or staff'
        },
        required:[true,"User's role is required"],
    },
},
        {timestamps:true}
)


module.exports=mongoose.model('User',userSchema)