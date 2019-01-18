module.exports = function (router, db, request, shortid) {

    let passport = require('passport');
    let GitHubStrategy = require('passport-github').Strategy;

    let githubCredentials = require('../config/github.json');
    passport.use(new GitHubStrategy({
            clientID: githubCredentials.production.clientID,
            clientSecret: githubCredentials.production.clientSecret,
            callbackURL: githubCredentials.production.callbackURL
        },
        function (accessToken, refreshToken, profile, cb) {
            console.log(accessToken);
            // console.log(profile);
            // Check Register
            db.query(`SELECT 0 FROM user WHERE id=?`, [profile.id], function (error, data) {
                if (error) {
                    throw error;
                }
                // console.log(profile);
                // console.log(data);
                if (data.length > 0) {
                    console.log('registered Member!!');
                } else {
                    db.query(`INSERT INTO user (login, id, avatar_url, name, bio) VALUES (?, ?, ?, ?, ?)`, [profile.username, profile.id, profile._json.avatar_url, profile._json.name, profile._json.bio]);

                    // Data
                    let githubAPI = "https://api.github.com/users/";
                    // User Information API Option Set
                    let userOptions = {
                        url: githubAPI + profile.username,
                        headers: {
                            "User-Agent": "request"
                        }
                    };
                    // User Repository API Option Set
                    let repositoryOptions = {
                        url: githubAPI + profile.username + "/repos",
                        headers: {
                            "User-Agent": "request"
                        }
                    };
                    // User Repository Information API Process
                    request(repositoryOptions, function (error, response, data) {
                        if (error) {
                            throw error;
                        }
                        let result = JSON.parse(data);

                        for (i = 0; i < result.length; i++) {
                            // console.log(result[i]);
                            let sid = shortid.generate();
                            let githubid = result[i].owner.login;
                            let name = result[i].name;
                            let githuburl = result[i].html_url;
                            let explanation = result[i].description;
                            let imgurl = result[i].language;
                            let created_at = result[i].created_at;
                            let updated_at = result[i].updated_at;
                            let sqlData = [sid, githubid, name, githuburl, explanation, imgurl, created_at, updated_at];
                            console.log(sqlData);
                            let sql = `INSERT INTO Personal_Data (id, githubid, name, githuburl, explanation, imgurl, pjdate1, pjdate2) VALUES (?,?,?,?,?,?,?,?)`;
                            db.query(sql, sqlData);
                        }
                    })
                }
            })
            return cb(null, profile);
        }
    ));

    router.use(passport.initialize());
    router.use(passport.session());

    passport.serializeUser(function (user, cb) {
        cb(null, user.id);
        console.log('serializeUser', user.id);
    });

    passport.deserializeUser(function (obj, cb) {
        db.query(`SELECT * FROM user WHERE id=?`, [obj], function (error, data) {
            if (error) {
                throw error;
            }
            cb(null, data[0]);
            console.log('DeserializerUser', data[0]);
        })
    });
    return passport;
}