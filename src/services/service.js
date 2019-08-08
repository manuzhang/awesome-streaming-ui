import axios from 'axios';

export default {
  getRepos: function() {
  	return axios.get("http://localhost:9091/repos").catch(ex => {
  	  return this.reject("getRepos", ex);
  	})
  }

};