const express = require("express");
var jwt = require("jsonwebtoken");
const User = require("../Models/User");
const bcrypt = require("bcrypt");
const router = express.Router();
const fetchuser = require("../middleware/fetchuser");
require("dotenv").config();
const { body, validationResult } = require("express-validator");
const { OAuth2Client } = require("google-auth-library");
const {
  forgetpassword,
  verifyToken,
  createUser,
  ResetPasswordByEmail,
} = require("../Controllers/auth");

// Configure Firebase OAuth2Client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const JWT_SECRET = "mern$Open$SourceProject";

// Route for Google Firebase authentication
router.post("/googlelogin", async (req, res) => {
  try {
    const { tokenId } = req.body;
    const response = await client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { email_verified, email, name } = response.payload;

    if (email_verified) {
      let user = await User.findOne({ email });
      if (!user) {
        const salt = await bcrypt.genSalt(10);
        const secPass = await bcrypt.hash(email + process.env.JWT_SECRET, salt);
        user = await User.create({
          name: name,
          email: email,
          password: secPass,
        });
      }
      const data = {
        user: {
          id: user.id,
        },
      };
      const authtoken = jwt.sign(data, JWT_SECRET);
      res.json({ success: true, authtoken });
    } else {
      res
        .status(400)
        .json({ success: false, error: "Google authentication failed." });
    }
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
});

// ROUTE 1 : Create a User using : POST: "/api/auth/createuser". No login required

// ROUTE 2 : Create a User using : POST: "/api/auth/login". No login required
router.post(
  "/login",
  [
    // Creating check vadilation for user credentials like name, email and password

    // Email must be an email
    body("email", "Enter a valid email").isEmail(),
    // Password must be at least 5 chars long
    body("password", "Password cannot be blank").exists(),
  ],
  async (req, res) => {
    let success = false;
    // If there are errors, return Bad request and the errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Return a status 400 and return json of error in the array form
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      // Below line is promise so await it
      let user = await User.findOne({ email });
      // If user is not available in database
      if (!user) {
        success = false;
        return res.status(400).json({
          success,
          error: "Please try to login with correct credentials",
        });
      }

      // Below line is promise so await it
      const passwordCompare = await bcrypt.compare(password, user.password);
      // If password does'nt matches with original password
      if (!passwordCompare) {
        success = false;
        return res.status(400).json({
          success,
          error: "Please try to login with correct credentials",
        });
      }

      // Define the data to sign the data with JWT_SECRET
      const data = {
        user: {
          id: user.id,
        },
      };

      // Sign the data and give the authtoken to the user
      const authtoken = jwt.sign(data, JWT_SECRET);
      success = true;
      res.json({ success }).cookies({ authtoken });
    } catch (error) {
      // Give internal server error (500)
      console.log(error.message);
      res.status(500).send("Internal Server Error");
    }
  }
);

// ROUTE 3 : Get Loggedin User Details : GET: "/api/auth/getuser". Login required
router.get("/getuser", fetchuser, async (req, res) => {
  try {
    let userId = req.user.id;
    // Below line is promise so await it. Find the user from id and select from the password
    const user = await User.findById(userId).select("-password");
    res.send(user);
  } catch (error) {
    // Give internal server error (500)
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/forget", forgetpassword);
router.post("/createUser", createUser);
router.post("/verify/:token", verifyToken);
router.post("/ResetByEmail", ResetPasswordByEmail);

module.exports = router;
