const dns=require('dns');
const mongoose=require('mongoose');

// The ISP's DNS servers refuse SRV lookups (needed for mongodb+srv:// URIs), so use public DNS instead.
dns.setServers(['8.8.8.8','1.1.1.1']);

async function connectDB(){
    const uri=process.env.MONGODB_URI;
    if(!uri){
        throw new Error('MONGODB_URI is not set');
    }

    mongoose.connection.on('connected',()=>{
        console.log("MongoDB connected");
    });

    mongoose.connection.on("error",(err)=>{
        console.log('MongoDB error: ',err.message);
    });

    await mongoose.connect(uri);
    return mongoose.connection;
}

module.exports=connectDB;