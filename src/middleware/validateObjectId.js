function validateObjectId(req,res,next){
    const{id}=req.params;

    const isValid=/^[a-fA-F0-9]{24}$/.test(id);

    if(!isValid){
        const err=new Error(`Invalid request ID: ${id}`)
        err.status=400;
        return next(err);
    }

    next();
}


module.exports=validateObjectId;