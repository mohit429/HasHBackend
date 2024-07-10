const express = require('express');
const zod = require("zod");
const { User , Post } = require('../db');
const jwt = require("jsonwebtoken");
const router = express.Router();
const { JWT_SECRET } = require("../config");
const { authMiddleware } = require("../middleware");
const mongoose = require('mongoose');

//user/signup
const signupBody = zod.object({
    name: zod.string(),
    email: zod.string().email(),
	password: zod.string().min(6)
})
router.post("/user/signup", async (req, res) => {
    const { success, data } = signupBody.safeParse(req.body);
    
    if (!success) {
        console.error('Incorrect inputs:', req.body);
        return res.status(400).json({
           message: "Incorrect inputs"
        });
    }

    try {
        // Check for existing user
        const existingUser = await User.findOne({ email: data.email });
        if (existingUser) {
            console.log('Email already taken:', data.email);
            return res.status(409).json({
                message: "Email already taken"
            });
        }

        // Create user
        const user = await User.create({
            name: data.name,
            email: data.email,
            password: data.password
        });

        const token = jwt.sign({ userId: user._id }, JWT_SECRET);

        console.log('User created successfully:', user._id);
        res.status(200).json({
            message: "User created successfully",
            token: token,
            userId: user._id
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
            message: "Server error"
        });
    }
});

//user/signin
const signinBody=zod.object({
    email: zod.string().email(),
    password: zod.string().min(6)
})
router.post("/user/signin", async (req, res) =>{

    const { success, data } = signinBody.safeParse(req.body);
    if (!success) {
        res.status(400).json({
           message: "Incorrect inputs"
       });
       return;
    }

    const user = await User.findOne({
        email: data.email,
        password: data.password
    });

    if(user){
        const token = jwt.sign({ userId: user._id }, JWT_SECRET);
        res.status(200).json({
            token: token,
            userId: user._id
        });
        return;
    }

    res.status(401).json({
        message: "Invalid MailId or password !"
    });


})
//post blog
router.post("/blog", authMiddleware, async (req, res) =>{
    const { title, content, userId } = req.body;
    // Log the incoming request body
    console.log('Request body:', req.body);
    // Check if userId is provided
    if (!userId) {
        return res.status(400).json({ message: "UserId is required" });
    }
    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid UserId format" });
    }
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }
        const post = await Post.create({
            title: title,
            content: content,
            author: userId
        });
        user.posts.push(post._id);
        await user.save();
        console.log('Updated User:', user);
        res.status(200).json({
            message: "Post created successfully!",
            postId: post._id
        });
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).send('Internal Server Error');
    }
        
})
//put blog

router.post("/Updateblog", authMiddleware, async (req, res) => {
    const { userId, postId, title, content } = req.body;

    // Log the incoming request body
    console.log('Request body:', req.body);

    if (!userId) {
        return res.status(400).json({ message: "UserId is required" });
    }

    // Validate ObjectId format for postId and userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid userId format" });
    }
    if (!mongoose.Types.ObjectId.isValid(postId)) {
        return res.status(400).json({ message: "Invalid postId format" });
    }

    try {
        const updatedPost = await Post.findOneAndUpdate(
            { _id: postId, author: userId },
            { title: title, content: content, published: true },
            { new: true, runValidators: true, upsert: false }
        );

        if (!updatedPost) {
            console.log("Post not found or user is not the author:", { postId, userId });
            return res.status(404).json({
                message: "Post not found or user is not the author."
            });
        }

        res.json({
            message: "Post Updated Successfully!",
            post: updatedPost
        });
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.delete("/deleteblog", authMiddleware, async (req, res) => {
    const { userId, postId } = req.body;
  
    // Log the incoming request body
    console.log('Request body:', req.body);
  
    if (!userId) {
      return res.status(400).json({ message: "UserId is required" });
    }
  
    // Validate ObjectId format for postId and userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId format" });
    }
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: "Invalid postId format" });
    }
  
    try {
      // Step 1: Find and delete the post
      const deletedPost = await Post.findOneAndDelete({ _id: postId, author: userId });
  
      if (!deletedPost) {
        console.log("Post not found or user is not the author:", { postId, userId });
        return res.status(404).json({
          message: "Post not found or user is not the author."
        });
      }
  
      // Step 2: Remove the post reference from the corresponding user's posts array
      const user = await User.findById(userId);
  
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      // Remove the deleted post's ID from the user's posts array
      user.posts = user.posts.filter(post => post.toString() !== postId);
      await user.save();
  
      // Step 3: Respond with success message
      res.json({
        message: "Post deleted successfully!",
        post: deletedPost
      });
    } catch (error) {
      console.error('Error deleting post:', error);
      res.status(500).send('Internal Server Error');
    }
  });

//get blog
router.post("/namewithauthId", authMiddleware, async (req, res) => {
    try {
        const { id } = req.body;

        const user = await User.findOne({
            _id: id 
        });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.status(200).json({
            name: user.name
        });
    } catch (error) {
        console.error("Error fetching author name:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// get bulk blog
router.get("/blog/bulk", authMiddleware, async (req, res) => {
    const filter = req.query.filter || "";
    let posts;

    if (filter) {
        posts = await Post.find({
            $or: [
                { title: { $regex: filter, $options: 'i' } },
                { content: { $regex: filter, $options: 'i' } }
            ]
        });
    } else {
        posts = await Post.find({});
    }

    res.status(200).json({
        posts
    });
});


module.exports = router;