const Datastore = require("nedb");
const express = require("express");
const path = require("path");
const session = require('express-session');
const saltRounds = 10; // number of salt rounds to use for hashing
const bcrypt = require('bcrypt');
const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "./public")));
app.use('/materialize', express.static(path.join(__dirname, '/node_modules/materialize-css/dist')));
app.use(express.json()); // this middleware is used to parse JSON data in the request body
app.use(session({
    secret: 'your_secret_key_here',
    resave: false,
    saveUninitialized: true
}));

const usersDB = new Datastore({ filename: 'users.db', autoload: true });
console.log('usersdb created');
const goalsDB = new Datastore({ filename: 'goals.db', autoload: true });
console.log('goalsdb created');

// Get goals for a user (assuming user is logged in)
app.get('/api/goals', (req, res) => {
    const userId = req.session.userId;
    goalsDB.find({ userId }, (err, goals) => {
        if (err) {
            console.error(err);
            res.sendStatus(500);
            return;
        }
        res.json(goals);
    });
});

// Add a new goal for a user
app.post('/api/goals', (req, res) => {
    const userId = req.session.userId;
    const { title, category, date, completed } = req.body;
    const goal = { userId, title, category, date, completed };
    goalsDB.insert(goal, (err, newGoal) => {
        if (err) {
            console.error(err);
            res.sendStatus(500);
            return;
        }
        res.json(newGoal);
    });
});

// Update a goal
app.put('/api/goals/:goalId', (req, res) => {
    const goalId = req.params.goalId;
    const updatedGoal = req.body;
    goalsDB.update({ _id: goalId }, updatedGoal, {}, (err) => {
        if (err) {
            console.error(err);
            res.sendStatus(500);
            return;
        }
        res.sendStatus(200);
    });
});

// Delete a goal
app.delete('/api/goals/:goalId', (req, res) => {
    const goalId = req.params.goalId;
    goalsDB.remove({ _id: goalId }, {}, (err) => {
        if (err) {
            console.error(err);
            res.sendStatus(500);
            return;
        }
        res.sendStatus(200);
    });
});


app.post('/register', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send('Username and password are required.');
    }
    // Add minimum and maximum length validation
    const MIN_USERNAME_LENGTH = 3;
    const MAX_USERNAME_LENGTH = 20;
    const MIN_PASSWORD_LENGTH = 8;
    const MAX_PASSWORD_LENGTH = 100;

    if (username.length < MIN_USERNAME_LENGTH || username.length > MAX_USERNAME_LENGTH) {
        return res.status(400).send(`Username must be between ${MIN_USERNAME_LENGTH} and ${MAX_USERNAME_LENGTH} characters.`);
    }

    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
        return res.status(400).send(`Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`);
    }
    usersDB.findOne({ username }, (err, user) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error registering user.');
        }
        // Hash the user's password before storing it in the database
        bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error registering user.');
            }

            // Store user's information in NeDB
            usersDB.insert({ username, password: hashedPassword }, (err, newUser) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Error registering user.');
                }

                if (user) {
                    return res.status(409).send('Username already exists.');
                }

                // Redirect user to a login page
                res.redirect('/login');
            });
        });
    });

});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send('Username and password are required.');
    }


    // Query the database for a user with the given username
    usersDB.findOne({ username }, (err, user) => {
        if (err) {
            console.error(err);
            res.sendStatus(500);
            return;
        }

        if (!user) {
            res.status(401).send('Invalid username or password');
            return;
        }

        // Use bcrypt to compare the hashed password in the database with the password entered by the user
        bcrypt.compare(password, user.password, (err, result) => {
            if (err) {
                console.error(err);
                res.sendStatus(500);
                return;
            }

            if (result) {
                // If the credentials are valid, set session variable then redirect the user to the about us page
                req.session.loggedIn = true;
                req.session.userId = user._id; // Store the user ID in the session
                res.redirect('/');
            } else {
                res.status(401).send('Invalid username or password');
            }
        });
    });
});

app.get("/", function(req, res) {
    res.sendFile(path.join(__dirname, "./public/about.html"));
});

app.get('/goals', (req, res) => {
    if (!req.session.loggedIn) {
        // If the user is not logged in, redirect them to the login page
        return res.redirect('/login');
    }

    res.sendFile(path.join(__dirname, "./public/goals.html"));
});

app.get("/register", function(req, res) {
    res.sendFile(path.join(__dirname, "./public/register.html"));
});

app.get("/login", function(req, res) {
    res.sendFile(path.join(__dirname, "./public/login.html"));
});

app.get("/about", function(req, res) {
    res.sendFile(path.join(__dirname, "./public/about.html"));
});

app.use(function(req, res) {
    res.status(404);
    res.send('Oops! We didn\'t find what you are looking for.');
})
app.listen(3000, () => {
    console.log('Server started on port 3000. Ctrl^c to quit.');
})